import 'server-only';

import { AppError } from '@/server/errors';
import { createSupabaseEntities } from '@/server/entities/supabase-collection';
import type { SupabaseServerClient } from '@/server/supabase';

import { createLifeRepository } from './life-repository';

import type { Appointment, Approval, AuditEntry, Expense, Payment, Repositories } from './types';

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
  const kouture = db.schema('kouture');
  const core = db.schema('core');

  return {
    life: createLifeRepository(entities),
    entities,

    kouture: {
      async listAppointments(range) {
        const rows = check(
          await kouture
            .from('appointments')
            .select(
              'id, client_id, starts_at, ends_at, status, price_cents, deposit_cents, source, clients(full_name), services(name)'
            )
            .gte('starts_at', range.from)
            .lt('starts_at', range.to)
            .order('starts_at'),
          'load appointments'
        ) as unknown as {
          id: string;
          client_id: string | null;
          starts_at: string;
          ends_at: string;
          status: Appointment['status'];
          price_cents: number;
          deposit_cents: number;
          source: Appointment['source'];
          clients: { full_name: string } | null;
          services: { name: string } | null;
        }[];
        return rows.map((r) => ({
          id: r.id,
          clientId: r.client_id,
          clientName: r.clients?.full_name ?? 'Walk-in',
          serviceName: r.services?.name ?? 'Service',
          startsAt: r.starts_at,
          endsAt: r.ends_at,
          status: r.status,
          priceCents: r.price_cents,
          depositCents: r.deposit_cents,
          source: r.source
        }));
      },
      async listPayments(range) {
        const rows = check(
          await kouture
            .from('payments')
            .select('id, appointment_id, kind, method, amount_cents, received_at')
            .gte('received_at', range.from)
            .lt('received_at', range.to),
          'load payments'
        ) as {
          id: string;
          appointment_id: string | null;
          kind: Payment['kind'];
          method: Payment['method'];
          amount_cents: number;
          received_at: string;
        }[];
        return rows.map((r) => ({
          id: r.id,
          appointmentId: r.appointment_id,
          kind: r.kind,
          method: r.method,
          amountCents: r.amount_cents,
          receivedAt: r.received_at
        }));
      },
      async listExpenses({ fromDay, toDay }) {
        const rows = check(
          await kouture
            .from('expenses')
            .select('id, category, vendor, amount_cents, spent_on')
            .gte('spent_on', fromDay)
            .lte('spent_on', toDay),
          'load expenses'
        ) as {
          id: string;
          category: Expense['category'];
          vendor: string | null;
          amount_cents: number;
          spent_on: string;
        }[];
        return rows.map((r) => ({
          id: r.id,
          category: r.category,
          vendor: r.vendor,
          amountCents: r.amount_cents,
          spentOn: r.spent_on
        }));
      },
      async clientStats(monthStart, lapsedBefore) {
        const total = await kouture.from('clients').select('id', { count: 'exact', head: true });
        const fresh = await kouture
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', monthStart);
        if (total.error || fresh.error) {
          throw new AppError('UPSTREAM', 'Failed to load client counts', {
            cause: total.error ?? fresh.error
          });
        }
        // Lapsed = no completed visit since `lapsedBefore` and nothing booked ahead.
        const recent = check(
          await kouture
            .from('appointments')
            .select('client_id')
            .or(
              `and(status.eq.completed,starts_at.gte.${lapsedBefore}),starts_at.gte.${new Date().toISOString()}`
            )
            .not('client_id', 'is', null),
          'load recent visits'
        ) as { client_id: string }[];
        const active = new Set(recent.map((r) => r.client_id)).size;
        return {
          total: total.count ?? 0,
          newThisMonth: fresh.count ?? 0,
          lapsed: Math.max(0, (total.count ?? 0) - active)
        };
      }
    },

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
