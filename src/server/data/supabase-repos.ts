import 'server-only';

import { AppError } from '@/server/errors';
import { createSupabaseEntities } from '@/server/entities/supabase-collection';
import type { SupabaseServerClient } from '@/server/supabase';

import { createKoutureRepository } from './kouture-repository';
import { createLifeRepository } from './life-repository';
import { createSupabaseAssistantRepository, createSupabaseTeamRepository } from './team-repository';

import type { Approval, AuditEntry, Repositories } from './types';

type PgError = { message: string; code?: string } | null;

function check<T>(result: { data: T | null; error: PgError }, what: string): T {
  if (result.error) {
    // RLS denials surface as 42501; anything else is an upstream failure.
    if (result.error.code === '42501') throw new AppError('FORBIDDEN', `Not allowed to ${what}.`);
    if (result.error.code === 'PGRST116')
      throw new AppError('NOT_FOUND', `Could not find ${what}.`);
    throw new AppError('UPSTREAM', `Failed to ${what}`, { cause: result.error });
  }
  if (result.data === null) throw new AppError('NOT_FOUND', `Could not find ${what}.`);
  return result.data;
}

type ApprovalRow = {
  id: string;
  domain: Approval['domain'];
  requested_by: string;
  action_type: Approval['actionType'];
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  risk: Approval['risk'];
  status: Approval['status'];
  decision_note: string | null;
  decided_at: string | null;
  expires_at: string;
  created_at: string;
};
const APPROVAL_COLUMNS =
  'id, domain, requested_by, action_type, title, summary, payload, risk, status, decision_note, decided_at, expires_at, created_at';
const toApproval = (r: ApprovalRow): Approval => ({
  id: r.id,
  domain: r.domain,
  requestedBy: r.requested_by,
  actionType: r.action_type,
  title: r.title,
  summary: r.summary,
  payload: r.payload,
  risk: r.risk,
  status: r.status,
  decisionNote: r.decision_note,
  decidedAt: r.decided_at,
  expiresAt: r.expires_at,
  createdAt: r.created_at
});

export function createSupabaseRepositories(
  db: SupabaseServerClient,
  ownerEmail: string
): Repositories {
  const entities = createSupabaseEntities(db);
  const core = db.schema('core');

  return {
    life: createLifeRepository(entities),
    entities,

    kouture: createKoutureRepository(entities),
    team: createSupabaseTeamRepository(db),
    assistant: createSupabaseAssistantRepository(db),

    core: {
      async getProfile() {
        const { data: auth } = await db.auth.getUser();
        if (!auth.user) throw new AppError('UNAUTHENTICATED', 'Please sign in.');
        const row = check(
          await core
            .from('profiles')
            .select('id, display_name, business_name, timezone')
            .eq('id', auth.user.id)
            .single(),
          'load your profile'
        ) as { id: string; display_name: string; business_name: string; timezone: string };
        return {
          id: row.id,
          email: auth.user.email ?? ownerEmail,
          displayName: row.display_name,
          businessName: row.business_name,
          timezone: row.timezone
        };
      },
      async listApprovals({ status, limit = 50 }) {
        let query = core
          .from('approvals')
          .select(APPROVAL_COLUMNS)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (status) query = query.eq('status', status);
        const rows = check(await query, 'load approvals') as ApprovalRow[];
        return rows.map(toApproval);
      },
      async countPendingApprovals() {
        const { count, error } = await core
          .from('approvals')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (error) throw new AppError('UPSTREAM', 'Failed to count approvals', { cause: error });
        return count ?? 0;
      },
      async decideApproval(id, decision, note) {
        // The database guard trigger re-checks state, expiry and that the
        // caller is the owner; the status filter makes double-taps a no-op.
        const result = await core
          .from('approvals')
          .update({ status: decision, decision_note: note })
          .eq('id', id)
          .eq('status', 'pending')
          .select(APPROVAL_COLUMNS)
          .maybeSingle();
        if (result.error) {
          if (result.error.message.includes('expired'))
            throw new AppError('CONFLICT', 'This request has expired.');
          throw new AppError('UPSTREAM', 'Failed to record your decision', { cause: result.error });
        }
        if (!result.data) throw new AppError('CONFLICT', 'This request was already decided.');
        return toApproval(result.data as ApprovalRow);
      },
      async listAudit({ domain, limit }) {
        let query = core
          .from('audit_log')
          .select(
            'id, occurred_at, actor_type, actor_id, domain, action, entity_type, entity_id, summary'
          )
          .order('occurred_at', { ascending: false })
          .limit(limit);
        if (domain) query = query.eq('domain', domain);
        const rows = check(await query, 'load the activity log') as {
          id: number;
          occurred_at: string;
          actor_type: AuditEntry['actorType'];
          actor_id: string;
          domain: AuditEntry['domain'];
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          summary: string;
        }[];
        return rows.map((r) => ({
          id: String(r.id),
          occurredAt: r.occurred_at,
          actorType: r.actor_type,
          actorId: r.actor_id,
          domain: r.domain,
          action: r.action,
          entityType: r.entity_type,
          entityId: r.entity_id,
          summary: r.summary
        }));
      }
    }
  };
}
