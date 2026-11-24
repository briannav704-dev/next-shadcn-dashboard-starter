import { addDays, daysBetween, startOfWeek } from '@/lib/dates';
import type { Goal, Habit } from '@/server/data/types';

export type HabitView = {
  id: string;
  name: string;
  doneToday: boolean;
  streak: number;
  thisWeek: number;
  targetPerWeek: number;
  last7: { day: string; done: boolean }[];
};

/** Consecutive logged days ending today, or ending yesterday if today is still open. */
export function currentStreak(loggedDays: Iterable<string>, todayKey: string): number {
  const set = new Set(loggedDays);
  let cursor = set.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function buildHabitViews(habits: Habit[], todayKey: string): HabitView[] {
  const weekStart = startOfWeek(todayKey);
  const last7 = daysBetween(addDays(todayKey, -6), todayKey);
  return habits.map((h) => {
    const set = new Set(h.loggedDays);
    return {
      id: h.id,
      name: h.name,
      doneToday: set.has(todayKey),
      streak: currentStreak(set, todayKey),
      thisWeek: h.loggedDays.filter((d) => d >= weekStart && d <= todayKey).length,
      targetPerWeek: h.targetPerWeek,
      last7: last7.map((day) => ({ day, done: set.has(day) }))
    };
  });
}

export function habitCompletionToday(views: HabitView[]): number {
  if (views.length === 0) return 0;
  return views.filter((v) => v.doneToday).length / views.length;
}

export function goalProgress(goal: Goal): number {
  return Math.max(0, Math.min(1, goal.currentValue / goal.targetValue));
}

/** Longest run of consecutive logged days. */
export function bestStreak(loggedDays: string[]): number {
  const sorted = [...new Set(loggedDays)].toSorted();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}
