import { addDays, dayKey, daysBetween, startOfMonth } from '@/lib/dates';
import type { Appointment, Expense, Payment } from '@/server/data/types';

export type RevenueDay = { day: string; stripeCents: number; cashCents: number };

export type KoutureSummary = {
  todayAppointments: Appointment[];
  upcoming: Appointment[];
  revenueSeries: RevenueDay[];
  monthToDate: { revenueCents: number; expenseCents: number; profitCents: number };
  previousMonthToDate: { revenueCents: number };
  mix: { stripeCents: number; cashCents: number; tipCents: number };
  averageTicketCents: number;
  bookedNext7: number;
  noShowRate30: number;
  expenseByCategory: { category: Expense['category']; cents: number }[];
};

const isLive = (a: Appointment) => a.status !== 'cancelled';

/** Net money in: deposits, balances and tips, less refunds. */
export function signedAmount(p: Payment): number {
  return p.kind === 'refund' ? -p.amountCents : p.amountCents;
}

export function buildKoutureSummary(input: {
  todayKey: string;
  timeZone: string;
  now: Date;
  appointments: Appointment[];
  payments: Payment[];
  expenses: Expense[];
  seriesDays?: number;
}): KoutureSummary {
  const { todayKey, timeZone, now, appointments, payments, expenses } = input;
  const seriesDays = input.seriesDays ?? 14;
  const monthStart = startOfMonth(todayKey);
  const dayOfMonth = Number(todayKey.slice(8, 10));
  const prevMonthStart = startOfMonth(addDays(monthStart, -1));
  const prevMonthSameDay = addDays(prevMonthStart, dayOfMonth - 1);

  const byDay = new Map<string, RevenueDay>();
  for (const day of daysBetween(addDays(todayKey, -(seriesDays - 1)), todayKey)) {
    byDay.set(day, { day, stripeCents: 0, cashCents: 0 });
  }

  let mtdRevenue = 0;
  let prevRevenue = 0;
  const mix = { stripeCents: 0, cashCents: 0, tipCents: 0 };

  for (const p of payments) {
    const day = dayKey(new Date(p.receivedAt), timeZone);
    const amount = signedAmount(p);
    const slot = byDay.get(day);
    if (slot) {
      if (p.method === 'stripe') slot.stripeCents += amount;
      else slot.cashCents += amount;
    }
    if (day >= monthStart && day <= todayKey) {
      mtdRevenue += amount;
      if (p.kind === 'tip') mix.tipCents += amount;
      else if (p.method === 'stripe') mix.stripeCents += amount;
      else mix.cashCents += amount;
    }
    if (day >= prevMonthStart && day <= prevMonthSameDay) prevRevenue += amount;
  }

  let mtdExpenses = 0;
  const categories = new Map<Expense['category'], number>();
  for (const e of expenses) {
    if (e.spentOn < monthStart || e.spentOn > todayKey) continue;
    mtdExpenses += e.amountCents;
    categories.set(e.category, (categories.get(e.category) ?? 0) + e.amountCents);
  }

  const nowIso = now.toISOString();
  const weekAheadIso = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const thirtyAgoIso = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const today = appointments.filter(
    (a) => isLive(a) && dayKey(new Date(a.startsAt), timeZone) === todayKey
  );
  const upcoming = appointments.filter(
    (a) => isLive(a) && a.startsAt > nowIso && dayKey(new Date(a.startsAt), timeZone) !== todayKey
  );
  const bookedNext7 = appointments.filter(
    (a) => isLive(a) && a.startsAt > nowIso && a.startsAt <= weekAheadIso
  ).length;

  const recentPast = appointments.filter(
    (a) =>
      a.startsAt >= thirtyAgoIso &&
      a.startsAt <= nowIso &&
      (a.status === 'completed' || a.status === 'no_show')
  );
  const noShows = recentPast.filter((a) => a.status === 'no_show').length;
  const completedThisMonth = appointments.filter(
    (a) => a.status === 'completed' && dayKey(new Date(a.startsAt), timeZone) >= monthStart
  );

  return {
    todayAppointments: today,
    upcoming: upcoming.slice(0, 6),
    revenueSeries: [...byDay.values()],
    monthToDate: {
      revenueCents: mtdRevenue,
      expenseCents: mtdExpenses,
      profitCents: mtdRevenue - mtdExpenses
    },
    previousMonthToDate: { revenueCents: prevRevenue },
    mix,
    averageTicketCents: completedThisMonth.length
      ? Math.round(
          completedThisMonth.reduce((s, a) => s + a.priceCents, 0) / completedThisMonth.length
        )
      : 0,
    bookedNext7,
    noShowRate30: recentPast.length ? noShows / recentPast.length : 0,
    expenseByCategory: [...categories.entries()]
      .map(([category, cents]) => ({ category, cents }))
      .toSorted((a, b) => b.cents - a.cents)
  };
}
