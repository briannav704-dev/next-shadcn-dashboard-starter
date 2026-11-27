import 'server-only';

import { DEFAULT_TIMEZONE, addDays, todayKey } from '@/lib/dates';
import type { EntityAccess } from '@/server/entities/collection';
import { type DemoTables, createDemoEntities } from '@/server/entities/demo-collection';
import { AppError } from '@/server/errors';

import { seedKoutureTables } from './demo-kouture-seed';
import { seedLifeTables } from './demo-life-seed';
import { createKoutureRepository } from './kouture-repository';
import { createLifeRepository } from './life-repository';

import type {
  AgentMessage,
  AgentTask,
  Approval,
  AssistantMessage,
  AssistantRepository,
  AssistantTask,
  AuditEntry,
  Domain,
  Repositories,
  TeamRepository
} from './types';

// Sample-data mode: an in-memory store seeded relative to "today" so the app is
// explorable before Supabase exists. It applies the same rules the database
// enforces (approval transitions, frozen payloads, audit on every write).
// Nothing here is persisted.

const TZ = DEFAULT_TIMEZONE;

type DemoState = {
  tables: DemoTables;
  approvals: Approval[];
  agentTasks: AgentTask[];
  agentMessages: AgentMessage[];
  assistantTasks: AssistantTask[];
  assistantMessages: AssistantMessage[];
  audit: AuditEntry[];
  seq: () => number;
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function seed(): DemoState {
  const today = todayKey(TZ);
  const rand = rng(20261124);
  let seq = 1;
  const id = (prefix: string) => `${prefix}_${(seq++).toString(36)}`;

  const tables: DemoTables = {
    ...seedLifeTables({ today, timeZone: TZ, rand, id }),
    ...seedKoutureTables({ today, timeZone: TZ, rand, id })
  };

  const nowIso = new Date().toISOString();
  const expires = new Date(Date.now() + 6 * 86_400_000).toISOString();
  const approvals: Approval[] = [
    {
      id: id('apr'),
      domain: 'kouture',
      requestedBy: 'marketing_director',
      actionType: 'publish_content',
      title: 'Instagram post: holiday chrome collection',
      summary: 'Carousel of 4 chrome sets with booking link in bio. Scheduled for Friday 6pm.',
      payload: {
        channel: 'instagram',
        scheduledFor: addDays(today, 3),
        caption: 'Holiday chrome is here ✨ Book through the link in bio.'
      },
      risk: 'low',
      status: 'pending',
      decisionNote: null,
      decidedAt: null,
      expiresAt: expires,
      createdAt: nowIso
    }
  ];

  return {
    tables,
    approvals,
    agentTasks: [],
    agentMessages: [],
    assistantTasks: [],
    assistantMessages: [],
    audit: [],
    seq: () => seq++
  };
}

const globalForDemo = globalThis as unknown as { koutureDemoStore?: DemoState };

function state(): DemoState {
  globalForDemo.koutureDemoStore ??= seed();
  return globalForDemo.koutureDemoStore;
}

function audit(
  domain: Domain,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  actor: { type: AuditEntry['actorType']; id: string } = { type: 'owner', id: 'demo-owner' }
) {
  const s = state();
  s.audit.unshift({
    id: `aud_${s.seq().toString(36)}`,
    occurredAt: new Date().toISOString(),
    actorType: actor.type,
    actorId: actor.id,
    domain,
    action,
    entityType,
    entityId,
    summary
  });
}

function demoEntities(): EntityAccess {
  return createDemoEntities({
    tables: () => state().tables,
    nextId: (prefix) => `${prefix}_${state().seq().toString(36)}`,
    audit: ({ domain, action, entityType, entityId, summary }) =>
      audit(domain, action, entityType, entityId, summary)
  });
}

/** Mirrors kouture.agent_file(): upserts by source key, dedupes approvals, attributes to the agent. */
function demoTeam(): TeamRepository {
  const now = () => new Date().toISOString();
  return {
    async listTasks({ status, agentKey, limit }) {
      return state()
        .agentTasks.filter(
          (t) => (!status || t.status === status) && (!agentKey || t.agentKey === agentKey)
        )
        .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit ?? Infinity)
        .map((t) => ({ ...t }));
    },
    async listMessages({ agentKey, limit }) {
      // Newest last in storage; reversing first keeps same-millisecond messages in order.
      return state()
        .agentMessages.filter((m) => !agentKey || m.agentKey === agentKey)
        .toReversed()
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map((m) => ({ ...m }));
    },
    async file(agentKey, filing) {
      const s = state();
      const actor = { type: 'agent' as const, id: agentKey };
      if (filing.kind === 'task') {
        const existing = s.agentTasks.find((t) => t.sourceKey === filing.sourceKey);
        const fields = {
          title: filing.title,
          detail: filing.detail ?? null,
          severity: filing.severity,
          href: filing.href ?? null
        };
        if (!existing) {
          const task: AgentTask = {
            id: `tsk_${s.seq().toString(36)}`,
            agentKey,
            sourceKey: filing.sourceKey,
            ...fields,
            status: 'open',
            createdAt: now(),
            updatedAt: now(),
            resolvedAt: null
          };
          s.agentTasks.push(task);
          audit(
            'kouture',
            'insert',
            'agent_tasks',
            task.id,
            `Insert agent tasks: ${task.title}`,
            actor
          );
          return;
        }
        const status = existing.status === 'dismissed' ? 'dismissed' : 'open';
        const changed =
          JSON.stringify([
            existing.title,
            existing.detail,
            existing.severity,
            existing.href,
            existing.status
          ]) !==
          JSON.stringify([fields.title, fields.detail, fields.severity, fields.href, status]);
        if (!changed) return;
        Object.assign(existing, fields, {
          status,
          resolvedAt: status === 'dismissed' ? existing.resolvedAt : null,
          updatedAt: now()
        });
        audit(
          'kouture',
          'update',
          'agent_tasks',
          existing.id,
          `Update agent tasks: ${existing.title}`,
          actor
        );
        return;
      }
      if (filing.kind === 'resolve') {
        const task = s.agentTasks.find(
          (t) => t.sourceKey === filing.sourceKey && t.status === 'open' && t.agentKey === agentKey
        );
        if (!task) return;
        Object.assign(task, { status: 'done', resolvedAt: now(), updatedAt: now() });
        audit(
          'kouture',
          'update',
          'agent_tasks',
          task.id,
          `Update agent tasks: ${task.title}`,
          actor
        );
        return;
      }
      if (filing.kind === 'message') {
        const message: AgentMessage = {
          id: `msg_${s.seq().toString(36)}`,
          agentKey,
          author: 'agent',
          kind: filing.messageKind,
          body: filing.body,
          createdAt: now()
        };
        s.agentMessages.push(message);
        audit('kouture', 'insert', 'agent_messages', message.id, 'Insert agent messages', actor);
        return;
      }
      if (s.approvals.some((a) => a.payload.sourceKey === filing.sourceKey)) return;
      const approval: Approval = {
        id: `apr_${s.seq().toString(36)}`,
        domain: 'kouture',
        requestedBy: agentKey,
        actionType: filing.actionType,
        title: filing.title,
        summary: filing.summary,
        payload: { ...filing.payload, sourceKey: filing.sourceKey },
        risk: filing.risk,
        status: 'pending',
        decisionNote: null,
        decidedAt: null,
        expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        createdAt: now()
      };
      s.approvals.unshift(approval);
      audit(
        'kouture',
        'insert',
        'approvals',
        approval.id,
        `Insert approvals: ${approval.title}`,
        actor
      );
    },
    async setTaskStatus(id, status) {
      const task = state().agentTasks.find((t) => t.id === id);
      if (!task) throw new AppError('NOT_FOUND', 'That task no longer exists.');
      Object.assign(task, {
        status,
        resolvedAt: status === 'open' ? null : now(),
        updatedAt: now()
      });
      audit('kouture', 'update', 'agent_tasks', id, `Update agent tasks: ${task.title}`);
    },
    async postOwnerMessage(agentKey, body) {
      const s = state();
      const message: AgentMessage = {
        id: `msg_${s.seq().toString(36)}`,
        agentKey,
        author: 'owner',
        kind: 'note',
        body,
        createdAt: now()
      };
      s.agentMessages.push(message);
      audit('kouture', 'insert', 'agent_messages', message.id, 'Insert agent messages');
    }
  };
}

/** Mirrors life.assistant_file(), attributed to the assistant. */
function demoAssistant(): AssistantRepository {
  const now = () => new Date().toISOString();
  const actor = { type: 'assistant' as const, id: 'life_assistant' };
  return {
    async listTasks({ status, limit }) {
      return state()
        .assistantTasks.filter((t) => !status || t.status === status)
        .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit ?? Infinity)
        .map((t) => ({ ...t }));
    },
    async listMessages(limit) {
      return state()
        .assistantMessages.toReversed()
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map((m) => ({ ...m }));
    },
    async file(filing) {
      const s = state();
      if (filing.kind === 'task') {
        const fields = {
          title: filing.title,
          detail: filing.detail ?? null,
          severity: filing.severity,
          href: filing.href ?? null
        };
        const existing = s.assistantTasks.find((t) => t.sourceKey === filing.sourceKey);
        if (!existing) {
          const task: AssistantTask = {
            id: `ast_${s.seq().toString(36)}`,
            sourceKey: filing.sourceKey,
            ...fields,
            status: 'open',
            createdAt: now(),
            updatedAt: now(),
            resolvedAt: null
          };
          s.assistantTasks.push(task);
          audit(
            'life',
            'insert',
            'assistant_tasks',
            task.id,
            `Insert assistant tasks: ${task.title}`,
            actor
          );
          return;
        }
        const status = existing.status === 'dismissed' ? 'dismissed' : 'open';
        const changed =
          JSON.stringify([
            existing.title,
            existing.detail,
            existing.severity,
            existing.href,
            existing.status
          ]) !==
          JSON.stringify([fields.title, fields.detail, fields.severity, fields.href, status]);
        if (!changed) return;
        Object.assign(existing, fields, {
          status,
          resolvedAt: status === 'dismissed' ? existing.resolvedAt : null,
          updatedAt: now()
        });
        audit(
          'life',
          'update',
          'assistant_tasks',
          existing.id,
          `Update assistant tasks: ${existing.title}`,
          actor
        );
        return;
      }
      if (filing.kind === 'resolve') {
        const task = s.assistantTasks.find(
          (t) => t.sourceKey === filing.sourceKey && t.status === 'open'
        );
        if (!task) return;
        Object.assign(task, { status: 'done', resolvedAt: now(), updatedAt: now() });
        audit(
          'life',
          'update',
          'assistant_tasks',
          task.id,
          `Update assistant tasks: ${task.title}`,
          actor
        );
        return;
      }
      const message: AssistantMessage = {
        id: `amg_${s.seq().toString(36)}`,
        author: 'assistant',
        kind: filing.messageKind,
        body: filing.body,
        createdAt: now()
      };
      s.assistantMessages.push(message);
      audit('life', 'insert', 'assistant_messages', message.id, 'Insert assistant messages', actor);
    },
    async setTaskStatus(id, status) {
      const task = state().assistantTasks.find((t) => t.id === id);
      if (!task) throw new AppError('NOT_FOUND', 'That item no longer exists.');
      Object.assign(task, {
        status,
        resolvedAt: status === 'open' ? null : now(),
        updatedAt: now()
      });
      audit('life', 'update', 'assistant_tasks', id, `Update assistant tasks: ${task.title}`);
    },
    async postOwnerMessage(body) {
      const s = state();
      const message: AssistantMessage = {
        id: `amg_${s.seq().toString(36)}`,
        author: 'owner',
        kind: 'note',
        body,
        createdAt: now()
      };
      s.assistantMessages.push(message);
      audit('life', 'insert', 'assistant_messages', message.id, 'Insert assistant messages');
    }
  };
}

export function createDemoRepositories(): Repositories {
  const entities = demoEntities();
  return {
    life: createLifeRepository(entities),
    entities,
    kouture: createKoutureRepository(entities),
    team: demoTeam(),
    assistant: demoAssistant(),
    core: {
      async getProfile() {
        return {
          id: 'demo-owner',
          email: 'owner@example.com',
          displayName: 'Beautiful',
          businessName: 'Kouture Nail Bar',
          timezone: TZ
        };
      },
      async listApprovals({ status, limit = 50 }) {
        return state()
          .approvals.filter((a) => !status || a.status === status)
          .slice(0, limit)
          .map((a) => ({ ...a }));
      },
      async countPendingApprovals() {
        return state().approvals.filter((a) => a.status === 'pending').length;
      },
      async decideApproval(id, decision, note) {
        const approval = state().approvals.find((a) => a.id === id);
        if (!approval) throw new AppError('NOT_FOUND', 'That request no longer exists.');
        if (approval.status !== 'pending') {
          throw new AppError('CONFLICT', `This request was already ${approval.status}.`);
        }
        if (approval.expiresAt < new Date().toISOString()) {
          throw new AppError('CONFLICT', 'This request has expired.');
        }
        approval.status = decision;
        approval.decisionNote = note;
        approval.decidedAt = new Date().toISOString();
        audit(
          'core',
          'update',
          'approvals',
          id,
          `${decision === 'approved' ? 'Approved' : 'Declined'}: ${approval.title}`
        );
        return { ...approval };
      },
      async listAudit({ domain, limit }) {
        return state()
          .audit.filter((e) => !domain || e.domain === domain)
          .slice(0, limit);
      }
    }
  };
}

/** Test hook: reset the store to a fresh seed. */
export function resetDemoStore() {
  globalForDemo.koutureDemoStore = seed();
}
