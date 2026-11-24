import 'server-only';

import { addDays, greetingFor, startOfDayInZone, todayKey } from '@/lib/dates';
import type { OwnerSession } from '@/server/session';

import { buildHabitViews } from '../lib/summary';

export async function loadLifeDashboard({ repos, profile }: OwnerSession, now = new Date()) {
  const tz = profile.timezone;
  const today = todayKey(tz, now);
  const from = startOfDayInZone(today, tz).toISOString();
  const to = startOfDayInZone(addDays(today, 8), tz).toISOString();

  const [tasks, habits, events, goals, todaysAppointments] = await Promise.all([
    repos.life.listOpenTasks(8),
    repos.life.listHabits({ fromDay: addDays(today, -60), toDay: today }),
    repos.life.listEvents({ from, to }),
    repos.life.listActiveGoals(),
    // Only the count of today's client bookings crosses into My Life, so you can
    // plan your day around the salon without business details leaking over.
    repos.kouture.listAppointments({
      from,
      to: startOfDayInZone(addDays(today, 1), tz).toISOString()
    })
  ]);

  return {
    today,
    greeting: greetingFor(now, tz),
    timeZone: tz,
    tasks,
    habits: buildHabitViews(habits, today),
    events,
    goals,
    salonBookingsToday: todaysAppointments.filter((a) => a.status !== 'cancelled').length
  };
}

export type LifeDashboardData = Awaited<ReturnType<typeof loadLifeDashboard>>;
