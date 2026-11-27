import 'server-only';

import { addDays, dayKey, startOfDayInZone, todayKey } from '@/lib/dates';
import type { OwnerSession } from '@/server/session';

import { type LifeSnapshot, runAssistant } from '../rules';

export async function loadLifeSnapshot(session: OwnerSession, now: Date): Promise<LifeSnapshot> {
  const { entities, life } = session.repos;
  const tz = session.profile.timezone;
  const today = todayKey(tz, now);
  const [
    tasks,
    events,
    habits,
    categories,
    transactions,
    savingsGoals,
    contributions,
    routines,
    trips,
    tripItems,
    journal
  ] = await Promise.all([
    entities('life.tasks').list({ eq: { status: 'open' } }),
    entities('life.events').list({
      range: {
        field: 'startsAt',
        gte: startOfDayInZone(today, tz).toISOString(),
        lt: startOfDayInZone(addDays(today, 2), tz).toISOString()
      }
    }),
    life.listHabits({ fromDay: addDays(today, -7), toDay: today }),
    entities('life.budget_categories').list(),
    entities('life.transactions').list({
      range: { field: 'occurredOn', gte: `${today.slice(0, 7)}-01`, lte: today }
    }),
    entities('life.savings_goals').list(),
    entities('life.savings_contributions').list(),
    entities('life.selfcare_routines').list({ eq: { archived: false } }),
    entities('life.trips').list(),
    entities('life.trip_items').list(),
    entities('life.journal_entries').list({
      range: { field: 'entryOn', gte: addDays(today, -7), lte: today }
    })
  ]);
  return {
    today,
    timeZone: tz,
    tasks,
    events,
    habits,
    categories,
    transactions,
    savingsGoals,
    contributions,
    routines,
    trips,
    tripItems,
    // Only the dates leave this function: the assistant never reads what you wrote.
    journalDays: journal.map((j) => j.entryOn)
  };
}

export async function runAssistantForOwner(
  session: OwnerSession,
  opts: { force: boolean; now?: Date }
) {
  const now = opts.now ?? new Date();
  const { assistant } = session.repos;
  const [snapshot, openTasks, messages] = await Promise.all([
    loadLifeSnapshot(session, now),
    assistant.listTasks({ status: 'open' }),
    assistant.listMessages(30)
  ]);
  const { findings, briefing } = runAssistant(snapshot);
  const current = new Set(findings.map((f) => f.sourceKey));
  const known = new Set(openTasks.map((t) => t.sourceKey));
  for (const f of findings) {
    await assistant.file({
      kind: 'task',
      sourceKey: f.sourceKey,
      title: f.title,
      detail: f.detail,
      severity: f.severity,
      href: f.href
    });
  }
  const stale = openTasks.filter((t) => !current.has(t.sourceKey));
  for (const t of stale) await assistant.file({ kind: 'resolve', sourceKey: t.sourceKey });

  const tz = session.profile.timezone;
  const briefedToday = messages.some(
    (m) => m.kind === 'briefing' && dayKey(new Date(m.createdAt), tz) === snapshot.today
  );
  if (opts.force || !briefedToday) {
    await assistant.file({ kind: 'message', messageKind: 'briefing', body: briefing });
  }
  return {
    opened: findings.filter((f) => !known.has(f.sourceKey)).length,
    closed: stale.length
  };
}
