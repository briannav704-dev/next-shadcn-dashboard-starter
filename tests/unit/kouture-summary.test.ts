import { describe, expect, it } from 'vitest';

import { buildKoutureSummary } from '@/features/kouture/lib/summary';
import type { Appointment, Expense, Payment } from '@/server/data/types';

const TZ = 'America/New_York';
const now = new Date('2026-11-24T17:00:00Z'); // noon in New York

function appt(
  partial: Partial<Appointment> & Pick<Appointment, 'id' | 'startsAt' | 'status'>
): Appointment {
  return {
    clientId: 'c1',
    clientName: 'Ava',
    serviceName: 'Gel-X',
    endsAt: partial.startsAt,
    priceCents: 8500,
    depositCents: 2500,
    source: 'nailzy',
    ...partial
  };
}

function pay(
  partial: Partial<Payment> & Pick<Payment, 'id' | 'kind' | 'method' | 'amountCents' | 'receivedAt'>
): Payment {
  return { appointmentId: null, ...partial };
}

describe('buildKoutureSummary', () => {
  const appointments = [
    appt({ id: 'a1', startsAt: '2026-11-24T15:00:00Z', status: 'completed' }),
    appt({ id: 'a2', startsAt: '2026-11-24T20:00:00Z', status: 'confirmed' }),
    appt({ id: 'a3', startsAt: '2026-11-24T22:00:00Z', status: 'cancelled' }),
    appt({ id: 'a4', startsAt: '2026-11-26T15:00:00Z', status: 'booked' }),
    appt({ id: 'a5', startsAt: '2026-11-10T15:00:00Z', status: 'no_show' }),
    appt({ id: 'a6', startsAt: '2026-11-12T15:00:00Z', status: 'completed', priceCents: 6500 })
  ];
  const payments = [
    pay({
      id: 'p1',
      kind: 'deposit',
      method: 'stripe',
      amountCents: 2500,
      receivedAt: '2026-11-20T15:00:00Z'
    }),
    pay({
      id: 'p2',
      kind: 'balance',
      method: 'cash',
      amountCents: 6000,
      receivedAt: '2026-11-24T16:00:00Z'
    }),
    pay({
      id: 'p3',
      kind: 'tip',
      method: 'cash',
      amountCents: 1500,
      receivedAt: '2026-11-24T16:00:00Z'
    }),
    pay({
      id: 'p4',
      kind: 'refund',
      method: 'stripe',
      amountCents: 2500,
      receivedAt: '2026-11-22T15:00:00Z'
    }),
    pay({
      id: 'p5',
      kind: 'deposit',
      method: 'stripe',
      amountCents: 2000,
      receivedAt: '2026-10-05T15:00:00Z'
    }),
    // Oct 1 02:00 UTC is still Sep 30 in New York, so it must not count toward October
    pay({
      id: 'p6',
      kind: 'balance',
      method: 'cash',
      amountCents: 999,
      receivedAt: '2026-10-01T02:00:00Z'
    })
  ];
  const expenses: Expense[] = [
    { id: 'e1', category: 'supplies', vendor: null, amountCents: 4000, spentOn: '2026-11-08' },
    { id: 'e2', category: 'rent', vendor: null, amountCents: 95000, spentOn: '2026-11-01' },
    { id: 'e3', category: 'rent', vendor: null, amountCents: 95000, spentOn: '2026-10-01' }
  ];

  const s = buildKoutureSummary({
    todayKey: '2026-11-24',
    timeZone: TZ,
    now,
    appointments,
    payments,
    expenses
  });

  it('nets refunds out of month-to-date revenue and subtracts expenses', () => {
    expect(s.monthToDate.revenueCents).toBe(2500 + 6000 + 1500 - 2500);
    expect(s.monthToDate.expenseCents).toBe(99000);
    expect(s.monthToDate.profitCents).toBe(7500 - 99000);
  });

  it('splits Stripe deposits, cash and tips', () => {
    expect(s.mix).toEqual({ stripeCents: 0, cashCents: 6000, tipCents: 1500 });
  });

  it('compares against the same point in the previous month, by local day', () => {
    expect(s.previousMonthToDate.revenueCents).toBe(2000);
  });

  it('lists today without cancellations and counts the week ahead', () => {
    expect(s.todayAppointments.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(s.upcoming.map((a) => a.id)).toEqual(['a4']);
    expect(s.bookedNext7).toBe(2);
  });

  it('computes average ticket and no-show rate', () => {
    expect(s.averageTicketCents).toBe(Math.round((8500 + 6500) / 2));
    expect(s.noShowRate30).toBeCloseTo(1 / 3);
  });

  it('builds a 14-day series ending today', () => {
    expect(s.revenueSeries).toHaveLength(14);
    expect(s.revenueSeries.at(-1)).toEqual({ day: '2026-11-24', stripeCents: 0, cashCents: 7500 });
  });
});
