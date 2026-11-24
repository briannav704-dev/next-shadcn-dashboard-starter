import { describe, expect, it } from 'vitest';

import { consentState } from '@/features/kouture/lib/consent';
import {
  birthdaysWithin,
  bookingsByWeekday,
  clientHistories,
  monthlyProfit,
  newVsReturning,
  rebookRate,
  retentionList,
  topServices
} from '@/features/kouture/lib/insights';
import type { Appointment } from '@/server/data/types';

const TZ = 'America/New_York';
const NOW = new Date('2026-11-24T17:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

let seq = 0;
function appt(
  clientId: string | null,
  startsAt: string,
  over: Partial<Appointment> = {}
): Appointment {
  return {
    id: `a${seq++}`,
    clientId,
    clientName: clientId ?? 'Walk-in',
    serviceName: 'Acrylic Fill — Short',
    startsAt,
    endsAt: startsAt,
    status: 'completed',
    priceCents: 5500,
    depositCents: 1500,
    source: 'nailzy',
    ...over
  };
}

describe('client history and retention', () => {
  const appointments = [
    appt('ava', daysAgo(63)),
    appt('ava', daysAgo(42)),
    appt('ava', daysAgo(21)), // 21-day rhythm, due today
    appt('bea', daysAgo(50)),
    appt('cam', daysAgo(200)),
    appt('dee', daysAgo(10)),
    appt('dee', daysAgo(-5), { status: 'booked' }), // booked ahead: never on a list
    appt('eve', daysAgo(30), { status: 'no_show' })
  ];
  const payments = [
    {
      id: 'p1',
      appointmentId: null,
      clientId: 'ava',
      kind: 'balance' as const,
      method: 'cash' as const,
      amountCents: 4000,
      receivedAt: daysAgo(21)
    },
    {
      id: 'p2',
      appointmentId: null,
      clientId: 'ava',
      kind: 'tip' as const,
      method: 'cash' as const,
      amountCents: 1000,
      receivedAt: daysAgo(21)
    },
    {
      id: 'p3',
      appointmentId: null,
      clientId: 'ava',
      kind: 'refund' as const,
      method: 'stripe' as const,
      amountCents: 500,
      receivedAt: daysAgo(20)
    }
  ];
  const histories = clientHistories(appointments, payments, NOW);
  const clients = ['ava', 'bea', 'cam', 'dee', 'eve'].map((id) => ({
    id,
    fullName: id,
    birthday: null
  }));

  it('summarises visits, rhythm, spend and the next booking', () => {
    expect(histories.get('ava')).toMatchObject({ visits: 3, cadenceDays: 21, spendCents: 4500 });
    expect(histories.get('dee')?.nextVisit).toBe(daysAgo(-5));
    expect(histories.get('eve')).toMatchObject({ visits: 0, noShows: 1 });
  });

  it('buckets clients by how overdue they are', () => {
    const list = retentionList(clients, histories, NOW);
    expect(list.map((e) => [e.clientId, e.bucket])).toEqual([
      ['ava', 'due'],
      ['bea', 'lapsed'],
      ['cam', 'lost']
    ]);
  });

  it('measures how many recent clients rebooked', () => {
    // Seen in 60 days: ava, bea, dee — only dee has a next visit.
    expect(rebookRate(histories, NOW)).toBeCloseTo(1 / 3);
  });
});

describe('business analytics', () => {
  it('builds monthly profit in the owner timezone', () => {
    const lines = monthlyProfit(
      ['2026-10-01', '2026-11-01'],
      [
        // 11pm Oct 31 in New York is already Nov 1 in UTC: still October.
        {
          id: '1',
          appointmentId: null,
          kind: 'balance',
          method: 'cash',
          amountCents: 5000,
          receivedAt: '2026-11-01T03:00:00Z'
        },
        {
          id: '2',
          appointmentId: null,
          kind: 'tip',
          method: 'cash',
          amountCents: 800,
          receivedAt: '2026-11-10T18:00:00Z'
        },
        {
          id: '3',
          appointmentId: null,
          kind: 'refund',
          method: 'stripe',
          amountCents: 300,
          receivedAt: '2026-11-11T18:00:00Z'
        }
      ],
      [{ id: 'e', category: 'rent', vendor: null, amountCents: 2000, spentOn: '2026-11-01' }],
      [appt('ava', '2026-11-10T16:00:00Z')],
      TZ
    );
    expect(lines[0]).toMatchObject({ serviceCents: 5000, profitCents: 5000, visits: 0 });
    expect(lines[1]).toMatchObject({
      tipCents: 800,
      refundCents: 300,
      expenseCents: 2000,
      profitCents: -1500,
      visits: 1
    });
  });

  it('ranks services, ignoring length variants', () => {
    const top = topServices([
      appt('a', daysAgo(1), { serviceName: 'Acrylic Fill — Long' }),
      appt('b', daysAgo(1), { serviceName: 'Acrylic Fill — Short' }),
      appt('c', daysAgo(1), { serviceName: 'Gel-X Full Set', priceCents: 8500 }),
      appt('d', daysAgo(1), { serviceName: 'Gel-X Full Set', status: 'cancelled' })
    ]);
    expect(top).toEqual([
      { name: 'Acrylic Fill', count: 2, revenueCents: 11000 },
      { name: 'Gel-X Full Set', count: 1, revenueCents: 8500 }
    ]);
  });

  it('counts bookings per weekday and new vs returning clients', () => {
    // Tue Nov 24 2026, 9pm New York = Wed in UTC: counts as Tuesday.
    const days = bookingsByWeekday([appt('a', '2026-11-25T02:00:00Z')], TZ);
    expect(days.find((d) => d.count === 1)?.day).toBe('Tue');
    const split = newVsReturning(
      ['2026-10-01', '2026-11-01'],
      [
        appt('a', '2026-10-05T16:00:00Z'),
        appt('a', '2026-11-05T16:00:00Z'),
        appt('b', '2026-11-06T16:00:00Z')
      ],
      TZ
    );
    expect(split).toEqual([
      { month: '2026-10-01', newClients: 1, returning: 0 },
      { month: '2026-11-01', newClients: 1, returning: 1 }
    ]);
  });

  it('finds birthdays across the year boundary', () => {
    const list = birthdaysWithin(
      [
        { id: 'a', fullName: 'A', birthday: '1994-01-03' },
        { id: 'b', fullName: 'B', birthday: '1990-12-30' },
        { id: 'c', fullName: 'C', birthday: '1990-06-01' }
      ],
      '2026-12-28',
      10
    );
    expect(list.map((c) => [c.id, c.inDays])).toEqual([
      ['b', 2],
      ['a', 6]
    ]);
  });
});

describe('marketing consent', () => {
  it('treats a later opt-out as final and no record as no consent', () => {
    expect(consentState(null, null)).toBe('unknown');
    expect(consentState('2026-01-01T00:00:00Z', null)).toBe('subscribed');
    expect(consentState('2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z')).toBe('opted_out');
    expect(consentState('2026-03-01T00:00:00Z', '2026-02-01T00:00:00Z')).toBe('subscribed');
  });
});
