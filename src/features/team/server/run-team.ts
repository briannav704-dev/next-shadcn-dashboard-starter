import 'server-only';

import { BUSINESS } from '@/config/business';
import { loadBusiness } from '@/features/kouture/server/load-business';
import { calendarFeedSource } from '@/features/kouture/server/nailzy-sync';
import { dayKey } from '@/lib/dates';
import type { AgentKey } from '@/server/data/types';
import { readEnv } from '@/server/env';
import type { OwnerSession } from '@/server/session';

import { TEAM_ORDER } from '../agents';
import { type TeamSnapshot, runTeam } from '../rules';

const HISTORY_DAYS = 400;

export async function loadTeamSnapshot(session: OwnerSession, now: Date): Promise<TeamSnapshot> {
  const { entities, core } = session.repos;
  const since = new Date(now.getTime() - HISTORY_DAYS * 86_400_000).toISOString();
  const [business, inventory, marketing, taxPayments, runs, pending] = await Promise.all([
    loadBusiness(session, since),
    entities('kouture.inventory_items').list({ eq: { archived: false } }),
    entities('kouture.marketing_items').list(),
    entities('kouture.tax_payments').list(),
    entities('kouture.sync_runs').list({ order: [{ field: 'ranAt', ascending: false }], limit: 1 }),
    core.countPendingApprovals()
  ]);
  return {
    now,
    timeZone: session.profile.timezone,
    appointments: business.appointments,
    payments: business.payments,
    expenses: business.expenses,
    clients: business.clients,
    inventory,
    marketing,
    taxPayments,
    calendar: {
      connected: calendarFeedSource(session.mode) === 'live',
      lastRun: runs[0] ? { ranAt: runs[0].ranAt, ok: runs[0].ok } : null
    },
    pendingApprovals: pending,
    bookingUrl: readEnv().NAILZY_BOOKING_URL ?? BUSINESS.nailzyBookingUrl
  };
}

export type TeamRunResult = { opened: number; closed: number; drafted: number; briefed: number };

/**
 * Runs every agent's checks and records the results. Re-running is safe: tasks
 * are keyed by condition, each draft is filed once, and briefings
 * post once a day unless `force` is set.
 */
export async function runTeamForOwner(
  session: OwnerSession,
  opts: { force: boolean; now?: Date }
): Promise<TeamRunResult> {
  const now = opts.now ?? new Date();
  const { team } = session.repos;
  const tz = session.profile.timezone;
  const [snapshot, openTasks, recentMessages] = await Promise.all([
    loadTeamSnapshot(session, now),
    team.listTasks({ status: 'open' }),
    team.listMessages({ limit: 200 })
  ]);
  const report = runTeam(snapshot);

  const current = new Set(report.findings.map((f) => f.sourceKey));
  const known = new Set(openTasks.map((t) => t.sourceKey));
  const stale = openTasks.filter((t) => !current.has(t.sourceKey));

  // Sequential writes keep the audit log in a readable order; a run is small.
  for (const f of report.findings) {
    await team.file(f.agent, {
      kind: 'task',
      sourceKey: f.sourceKey,
      title: f.title,
      detail: f.detail,
      severity: f.severity,
      href: f.href
    });
  }
  for (const t of stale) await team.file(t.agentKey, { kind: 'resolve', sourceKey: t.sourceKey });
  for (const d of report.drafts) {
    await team.file(d.agent, {
      kind: 'approval',
      sourceKey: d.sourceKey,
      actionType: d.actionType,
      title: d.title,
      summary: d.summary,
      payload: d.payload,
      risk: d.risk
    });
  }

  const today = dayKey(now, tz);
  const briefedToday = new Set(
    recentMessages
      .filter((m) => m.kind === 'briefing' && dayKey(new Date(m.createdAt), tz) === today)
      .map((m) => m.agentKey)
  );
  let briefed = 0;
  for (const agent of TEAM_ORDER as AgentKey[]) {
    if (!opts.force && briefedToday.has(agent)) continue;
    await team.file(agent, {
      kind: 'message',
      messageKind: 'briefing',
      body: report.briefings[agent]
    });
    briefed++;
  }

  return {
    opened: report.findings.filter((f) => !known.has(f.sourceKey)).length,
    closed: stale.length,
    drafted: report.drafts.length,
    briefed
  };
}
