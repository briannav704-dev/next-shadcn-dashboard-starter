import 'server-only';

import { DEFAULT_TIMEZONE, addDays, todayKey } from '@/lib/dates';
import type { EntityAccess } from '@/server/entities/collection';
import { type DemoTables, createDemoEntities } from '@/server/entities/demo-collection';
import { AppError } from '@/server/errors';

import { seedKoutureTables } from './demo-kouture-seed';
import { seedLifeTables } from './demo-life-seed';
import { createKoutureRepository } from './kouture-repository';
import { createLifeRepository } from './life-repository';

import type { Approval, AuditEntry, Domain, Repositories } from './types';

// Sample-data mode: an in-memory store seeded relative to "today" so the app is
// explorable before Supabase exists. It applies the same rules the database
// enforces (approval transitions, frozen payloads, audit on every write).
// Nothing here is persisted.

const TZ = DEFAULT_TIMEZONE;

type DemoState = {
  tables: DemoTables;
  approvals: Approval[];
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
    },
    {
      id: id('apr'),
      domain: 'kouture',
      requestedBy: 'client_relations',
      actionType: 'send_message',
      title: 'Win-back text to 6 lapsed clients',
      summary:
        'Clients not seen in 60+ days who have SMS consent. Offers 10% off a fill this month.',
      payload: {
        channel: 'sms',
        recipients: 6,
        body: 'Hi {first_name}! We miss you at Kouture 💅 Enjoy 10% off a fill this month. Reply STOP to opt out.'
      },
      risk: 'medium',
      status: 'pending',
      decisionNote: null,
      decidedAt: null,
      expiresAt: expires,
      createdAt: nowIso
    },
    {
      id: id('apr'),
      domain: 'kouture',
      requestedBy: 'inventory_manager',
      actionType: 'make_purchase',
      title: 'Restock: builder gel & top coat',
      summary:
        'Projected to run out in 9 days at current pace. Estimated $142.60 from your usual supplier.',
      payload: {
        vendor: 'usual supplier',
        estimatedCents: 14260,
        items: ['Builder gel clear ×3', 'No-wipe top coat ×2']
      },
      risk: 'medium',
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
  summary: string
) {
  const s = state();
  s.audit.unshift({
    id: `aud_${s.seq().toString(36)}`,
    occurredAt: new Date().toISOString(),
    actorType: 'owner',
    actorId: 'demo-owner',
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

export function createDemoRepositories(): Repositories {
  const entities = demoEntities();
  return {
    life: createLifeRepository(entities),
    entities,
    kouture: createKoutureRepository(entities),
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
