import 'server-only';

import { AppError } from '@/server/errors';
import type { SupabaseServerClient } from '@/server/supabase';

import type { AgentFiling, AgentMessage, AgentTask, TeamRepository } from './types';

type PgError = { message: string; code?: string } | null;

// Table or function not found: the AI team migration hasn't been run yet.
const MISSING = new Set(['42P01', '42883', 'PGRST202', 'PGRST205']);

function fail(error: PgError, what: string): never {
  if (error?.code === '42501') throw new AppError('FORBIDDEN', `Not allowed to ${what}.`);
  if (error?.code && MISSING.has(error.code)) {
    throw new AppError(
      'INVALID',
      'Your database needs the AI team update. Paste supabase/migrations/20261128000001_ai_team.sql into the Supabase SQL Editor and run it once.'
    );
  }
  throw new AppError('UPSTREAM', `Failed to ${what}`, { cause: error });
}

type TaskRow = {
  id: string;
  agent_key: AgentTask['agentKey'];
  source_key: string;
  title: string;
  detail: string | null;
  severity: AgentTask['severity'];
  href: string | null;
  status: AgentTask['status'];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};
const TASK_COLUMNS =
  'id, agent_key, source_key, title, detail, severity, href, status, created_at, updated_at, resolved_at';
const toTask = (r: TaskRow): AgentTask => ({
  id: r.id,
  agentKey: r.agent_key,
  sourceKey: r.source_key,
  title: r.title,
  detail: r.detail,
  severity: r.severity,
  href: r.href,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  resolvedAt: r.resolved_at
});

/** Payload for kouture.agent_file(), which validates and attributes every write. */
export function filingPayload(filing: AgentFiling): {
  kind: string;
  data: Record<string, unknown>;
} {
  switch (filing.kind) {
    case 'task':
      return {
        kind: 'task',
        data: {
          sourceKey: filing.sourceKey,
          title: filing.title,
          detail: filing.detail ?? null,
          severity: filing.severity,
          href: filing.href ?? null
        }
      };
    case 'resolve':
      return { kind: 'resolve', data: { sourceKey: filing.sourceKey } };
    case 'message':
      return { kind: 'message', data: { kind: filing.messageKind, body: filing.body } };
    case 'approval':
      return {
        kind: 'approval',
        data: {
          sourceKey: filing.sourceKey,
          actionType: filing.actionType,
          title: filing.title,
          summary: filing.summary,
          payload: filing.payload,
          risk: filing.risk
        }
      };
  }
}

export function createSupabaseTeamRepository(db: SupabaseServerClient): TeamRepository {
  const kouture = db.schema('kouture');
  return {
    async listTasks({ status, agentKey, limit }) {
      let q = kouture
        .from('agent_tasks')
        .select(TASK_COLUMNS)
        .order('updated_at', { ascending: false });
      if (status) q = q.eq('status', status);
      if (agentKey) q = q.eq('agent_key', agentKey);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) fail(error, 'load the team’s tasks');
      return ((data ?? []) as TaskRow[]).map(toTask);
    },
    async listMessages({ agentKey, limit }) {
      let q = kouture
        .from('agent_messages')
        .select('id, agent_key, author, kind, body, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (agentKey) q = q.eq('agent_key', agentKey);
      const { data, error } = await q;
      if (error) fail(error, 'load messages');
      return (
        (data ?? []) as {
          id: string;
          agent_key: AgentMessage['agentKey'];
          author: AgentMessage['author'];
          kind: AgentMessage['kind'];
          body: string;
          created_at: string;
        }[]
      ).map((r) => ({
        id: r.id,
        agentKey: r.agent_key,
        author: r.author,
        kind: r.kind,
        body: r.body,
        createdAt: r.created_at
      }));
    },
    async file(agentKey, filing) {
      const { kind, data } = filingPayload(filing);
      const { error } = await kouture.rpc('agent_file', {
        p_agent_key: agentKey,
        p_kind: kind,
        p_data: data
      });
      if (error) fail(error, 'record the team’s work');
    },
    async setTaskStatus(id, status) {
      const { error, count } = await kouture
        .from('agent_tasks')
        .update(
          { status, resolved_at: status === 'open' ? null : new Date().toISOString() },
          { count: 'exact' }
        )
        .eq('id', id);
      if (error) fail(error, 'update that task');
      if (count === 0) throw new AppError('NOT_FOUND', 'That task no longer exists.');
    },
    async postOwnerMessage(agentKey, body) {
      const { error } = await kouture
        .from('agent_messages')
        .insert({ agent_key: agentKey, author: 'owner', kind: 'note', body });
      if (error) fail(error, 'send your message');
    }
  };
}
