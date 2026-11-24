import { addDays, daysBetween, startOfMonth, startOfWeek } from '@/lib/dates';
import type { RowOf } from '@/server/entities/definitions';

type Category = RowOf<'life.budget_categories'>;
type Transaction = RowOf<'life.transactions'>;
type SavingsGoal = RowOf<'life.savings_goals'>;
type Contribution = RowOf<'life.savings_contributions'>;
type Routine = RowOf<'life.selfcare_routines'>;
type WorkoutLog = RowOf<'life.workout_logs'>;
type Journal = RowOf<'life.journal_entries'>;
type Trip = RowOf<'life.trips'>;
type TripItem = RowOf<'life.trip_items'>;

export function daysFrom(fromKey: string, toKey: string): number {
  return Math.round(
    (Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000
  );
}

export function endOfMonth(key: string): string {
  return addDays(startOfMonth(addDays(startOfMonth(key), 32)), -1);
}

export function shiftMonth(monthKey: string, months: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** Calendar months from one day to another (Nov 24 → Feb 24 is 3; Nov 24 → Feb 23 is 2). */
export function wholeMonthsBetween(fromKey: string, toKey: string): number {
  const [y1, m1, d1] = fromKey.split('-').map(Number);
  const [y2, m2, d2] = toKey.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

// ── Budget ─────────────────────────────────────────────────────────────────
export type CategoryLine = {
  category: Category;
  spentCents: number;
  /** 0..n; above 1 means over budget. null when there is no limit. */
  usage: number | null;
};

export function budgetSummary(categories: Category[], transactions: Transaction[]) {
  const spent = new Map<string | null, number>();
  let incomeCents = 0;
  let expenseCents = 0;
  for (const t of transactions) {
    if (t.kind === 'income') incomeCents += t.amountCents;
    else {
      expenseCents += t.amountCents;
      spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amountCents);
    }
  }
  const lines: CategoryLine[] = categories
    .filter((c) => c.kind === 'expense' && !c.archived)
    .map((category) => {
      const spentCents = spent.get(category.id) ?? 0;
      return {
        category,
        spentCents,
        usage: category.monthlyLimitCents ? spentCents / category.monthlyLimitCents : null
      };
    });
  const plannedCents = lines.reduce((s, l) => s + (l.category.monthlyLimitCents ?? 0), 0);
  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    plannedCents,
    uncategorizedCents: spent.get(null) ?? 0,
    lines
  };
}

// ── Savings ────────────────────────────────────────────────────────────────
export function savingsProgress(goal: SavingsGoal, contributions: Contribution[], today: string) {
  const savedCents = contributions
    .filter((c) => c.goalId === goal.id)
    .reduce((s, c) => s + c.amountCents, 0);
  const remainingCents = Math.max(0, goal.targetCents - savedCents);
  let monthlyNeededCents: number | null = null;
  if (goal.targetDate && remainingCents > 0) {
    const months = Math.max(1, wholeMonthsBetween(today, goal.targetDate));
    monthlyNeededCents = Math.ceil(remainingCents / months);
  }
  return {
    savedCents,
    remainingCents,
    progress: Math.max(0, Math.min(1, savedCents / goal.targetCents)),
    monthlyNeededCents,
    overdue: Boolean(goal.targetDate && goal.targetDate < today && remainingCents > 0)
  };
}

// ── Self-care ──────────────────────────────────────────────────────────────
export type RoutineStatus = 'overdue' | 'due' | 'soon' | 'ok' | 'never';

export function routineStatus(routine: Routine, today: string) {
  if (!routine.lastDoneOn)
    return { nextDue: today, daysUntil: 0, status: 'never' as RoutineStatus };
  const nextDue = addDays(routine.lastDoneOn, routine.everyDays);
  const daysUntil = daysFrom(today, nextDue);
  const status: RoutineStatus =
    daysUntil < 0 ? 'overdue' : daysUntil === 0 ? 'due' : daysUntil <= 3 ? 'soon' : 'ok';
  return { nextDue, daysUntil, status };
}

const STATUS_ORDER: Record<RoutineStatus, number> = {
  overdue: 0,
  never: 1,
  due: 2,
  soon: 3,
  ok: 4
};

export function sortRoutines(routines: Routine[], today: string) {
  return routines
    .filter((r) => !r.archived)
    .map((r) => ({ routine: r, ...routineStatus(r, today) }))
    .toSorted(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.daysUntil - b.daysUntil
    );
}

// ── Fitness ────────────────────────────────────────────────────────────────
export function fitnessSummary(logs: WorkoutLog[], today: string, weeks = 8) {
  const thisWeekStart = startOfWeek(today);
  const series = Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(thisWeekStart, -7 * (weeks - 1 - i));
    const weekEnd = addDays(weekStart, 6);
    const inWeek = logs.filter((l) => l.performedOn >= weekStart && l.performedOn <= weekEnd);
    return {
      weekStart,
      minutes: inWeek.reduce((s, l) => s + l.durationMinutes, 0),
      sessions: inWeek.length
    };
  });
  const thisWeek = series.at(-1)!;
  // Consecutive weeks (ending this week or last) with at least one session.
  let streakWeeks = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].sessions > 0) streakWeeks++;
    else if (i === series.length - 1) continue;
    else break;
  }
  const kinds = new Map<string, number>();
  for (const l of logs.filter((l) => l.performedOn >= addDays(today, -29))) {
    kinds.set(l.kind, (kinds.get(l.kind) ?? 0) + l.durationMinutes);
  }
  return {
    series,
    thisWeekMinutes: thisWeek.minutes,
    thisWeekSessions: thisWeek.sessions,
    streakWeeks,
    last30ByKind: [...kinds.entries()]
      .map(([kind, minutes]) => ({ kind, minutes }))
      .toSorted((a, b) => b.minutes - a.minutes)
  };
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a day key. */
export function isoWeekday(key: string): number {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

// ── Calendar ───────────────────────────────────────────────────────────────
/** Weeks (Monday first) covering the month that contains `monthKey`. */
export function monthGrid(monthKey: string): string[][] {
  const first = startOfMonth(monthKey);
  const last = endOfMonth(first);
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 6);
  const days = daysBetween(start, end);
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

// ── Journal ────────────────────────────────────────────────────────────────
export function moodSummary(entries: Journal[], today: string, days = 30) {
  const from = addDays(today, -(days - 1));
  const recent = entries.filter((e) => e.entryOn >= from && e.entryOn <= today && e.mood !== null);
  const average = recent.length
    ? recent.reduce((s, e) => s + (e.mood ?? 0), 0) / recent.length
    : null;
  // Writing streak: consecutive days with an entry, ending today or yesterday.
  const written = new Set(entries.map((e) => e.entryOn));
  let cursor = written.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (written.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return { average, count: recent.length, streak };
}

// ── Travel ─────────────────────────────────────────────────────────────────
export function tripSummary(trip: Trip, items: TripItem[], today: string) {
  const mine = items.filter((i) => i.tripId === trip.id);
  const packing = mine.filter((i) => i.kind === 'packing');
  const committedCents = mine.reduce((s, i) => s + (i.costCents ?? 0), 0);
  return {
    daysUntil: daysFrom(today, trip.startsOn),
    nights: daysFrom(trip.startsOn, trip.endsOn),
    committedCents,
    budgetUsage: trip.budgetCents ? committedCents / trip.budgetCents : null,
    packed: packing.filter((i) => i.done).length,
    packingTotal: packing.length,
    inProgress: trip.startsOn <= today && trip.endsOn >= today
  };
}
