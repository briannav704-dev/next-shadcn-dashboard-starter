import 'server-only';

import { shiftMonth } from '@/features/life/lib/modules';
import { startOfDayInZone, startOfMonth, todayKey } from '@/lib/dates';
import type { OwnerSession } from '@/server/session';

import { monthlyProfit } from '../lib/insights';

import { loadBusiness } from './load-business';

/** Month-by-month profit for the last `months` months, oldest first. */
export async function loadProfitReport(session: OwnerSession, months: number) {
  const tz = session.profile.timezone;
  const current = startOfMonth(todayKey(tz));
  const keys = Array.from({ length: months }, (_, i) => shiftMonth(current, i - months + 1));
  const data = await loadBusiness(session, startOfDayInZone(keys[0], tz).toISOString());
  return {
    keys,
    data,
    lines: monthlyProfit(keys, data.payments, data.expenses, data.appointments, tz)
  };
}
