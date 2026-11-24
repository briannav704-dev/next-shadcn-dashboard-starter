import 'server-only';

import { addDays, startOfDayInZone, startOfMonth, todayKey } from '@/lib/dates';
import type { OwnerSession } from '@/server/session';

import { buildKoutureSummary } from '../lib/summary';

export async function loadKoutureDashboard({ repos, profile }: OwnerSession, now = new Date()) {
  const tz = profile.timezone;
  const today = todayKey(tz, now);
  const prevMonthStart = startOfMonth(addDays(startOfMonth(today), -1));
  const windowStart = [prevMonthStart, addDays(today, -40)].toSorted()[0];
  const from = startOfDayInZone(windowStart, tz).toISOString();
  const to = startOfDayInZone(addDays(today, 15), tz).toISOString();

  const [appointments, payments, expenses, clients] = await Promise.all([
    repos.kouture.listAppointments({ from, to }),
    repos.kouture.listPayments({ from, to: now.toISOString() }),
    repos.kouture.listExpenses({ fromDay: windowStart, toDay: today }),
    repos.kouture.clientStats(
      startOfDayInZone(startOfMonth(today), tz).toISOString(),
      new Date(now.getTime() - 60 * 86_400_000).toISOString()
    )
  ]);

  return {
    today,
    timeZone: tz,
    clients,
    ...buildKoutureSummary({ todayKey: today, timeZone: tz, now, appointments, payments, expenses })
  };
}

export type KoutureDashboardData = Awaited<ReturnType<typeof loadKoutureDashboard>>;
