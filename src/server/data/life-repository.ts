import 'server-only';

import type { EntityAccess } from '@/server/entities/collection';

import type { Habit, LifeRepository, Task } from './types';

const RECENTLY_DONE_MS = 12 * 3_600_000;

function byDueDate(a: Task, b: Task) {
  return (a.dueOn ?? '9999-12-31').localeCompare(b.dueOn ?? '9999-12-31');
}

/** Dashboard-level My Life queries, built on the entity collections so both modes share them. */
export function createLifeRepository(entities: EntityAccess): LifeRepository {
  return {
    async listOpenTasks(limit) {
      const tasks = entities('life.tasks');
      const [open, recentlyDone] = await Promise.all([
        tasks.list({ eq: { status: 'open' } }),
        // Keep just-ticked tasks visible (struck through) for the rest of the day.
        tasks.list({
          eq: { status: 'done' },
          range: {
            field: 'completedAt',
            gte: new Date(Date.now() - RECENTLY_DONE_MS).toISOString()
          }
        })
      ]);
      return [...open, ...recentlyDone].toSorted(byDueDate).slice(0, limit);
    },
    async setTaskDone(id, done) {
      return entities('life.tasks').update(id, {
        status: done ? 'done' : 'open',
        completedAt: done ? new Date().toISOString() : null
      });
    },
    async listHabits({ fromDay, toDay }) {
      const [habits, logs] = await Promise.all([
        entities('life.habits').list({ eq: { archived: false }, order: [{ field: 'sortOrder' }] }),
        entities('life.habit_logs').list({ range: { field: 'loggedOn', gte: fromDay, lte: toDay } })
      ]);
      const byHabit = new Map<string, string[]>();
      for (const log of logs)
        byHabit.set(log.habitId, [...(byHabit.get(log.habitId) ?? []), log.loggedOn]);
      return habits.map((h): Habit => ({
        id: h.id,
        name: h.name,
        targetPerWeek: h.targetPerWeek,
        loggedDays: (byHabit.get(h.id) ?? []).toSorted()
      }));
    },
    async setHabitLogged(habitId, day, logged) {
      const logs = entities('life.habit_logs');
      if (logged) {
        await logs.upsert({ habitId, loggedOn: day });
        return;
      }
      const existing = await logs.list({ eq: { habitId, loggedOn: day } });
      await Promise.all(existing.map((log) => logs.remove(log.id)));
    },
    async listEvents(range) {
      return entities('life.events').list({
        range: { field: 'startsAt', gte: range.from, lt: range.to },
        order: [{ field: 'startsAt' }]
      });
    },
    async listActiveGoals() {
      return entities('life.goals').list({
        eq: { status: 'active' },
        order: [{ field: 'targetDate' }]
      });
    }
  };
}
