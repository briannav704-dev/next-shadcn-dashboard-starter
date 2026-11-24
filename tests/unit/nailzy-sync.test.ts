import { describe, expect, it } from 'vitest';

import { demoFeed } from '@/features/kouture/sync/demo-feed';
import { parseIcs } from '@/features/kouture/sync/ics';
import {
  type ExistingAppointment,
  matchService,
  parseBookingTitle,
  planSync
} from '@/features/kouture/sync/plan';

const TZ = 'America/New_York';
const NOW = new Date('2026-11-24T15:00:00Z');

const MENU = [
  { id: 'svc_fill', name: 'Acrylic Fill', priceCents: 5500, depositCents: 1500 },
  { id: 'svc_full', name: 'Acrylic Full Set', priceCents: 7500, depositCents: 2500 },
  { id: 'svc_mani', name: 'Kouture Classic Manicure', priceCents: 3500, depositCents: 1000 }
];

const feed = (...events: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n');
const vevent = (lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');

describe('parseIcs', () => {
  it('reads UTC, zoned, folded and escaped events', () => {
    const events = parseIcs(
      feed(
        vevent([
          'UID:abc@google.com',
          'DTSTART:20261125T160000Z',
          'DTEND:20261125T173500Z',
          'SUMMARY:Jen Rivera — Acrylic Fill — Short'
        ]),
        vevent([
          'UID:def@google.com',
          'DTSTART;TZID=America/New_York:20261125T130000',
          'DURATION:PT2H45M',
          'SUMMARY:Jamiyla Hills — Acrylic Full Set — Short\\, Kouture Classic',
          '  Manicure',
          'BEGIN:VALARM',
          'SUMMARY:Reminder',
          'END:VALARM'
        ])
      ),
      TZ
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      uid: 'abc@google.com',
      start: '2026-11-25T16:00:00.000Z',
      end: '2026-11-25T17:35:00.000Z',
      summary: 'Jen Rivera — Acrylic Fill — Short',
      cancelled: false,
      unsupported: null
    });
    // 1pm Eastern is 6pm UTC in November.
    expect(events[1].start).toBe('2026-11-25T18:00:00.000Z');
    expect(events[1].end).toBe('2026-11-25T20:45:00.000Z');
    expect(events[1].summary).toBe(
      'Jamiyla Hills — Acrylic Full Set — Short, Kouture Classic Manicure'
    );
  });

  it('flags all-day and recurring events, and reads cancellations', () => {
    const events = parseIcs(
      feed(
        vevent(['UID:a', 'DTSTART;VALUE=DATE:20261125', 'SUMMARY:Holiday']),
        vevent(['UID:b', 'DTSTART:20261125T160000Z', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Gym']),
        vevent(['UID:c', 'DTSTART:20261125T160000Z', 'STATUS:CANCELLED', 'SUMMARY:A — B'])
      ),
      TZ
    );
    expect(events.map((e) => e.unsupported)).toEqual(['all_day', 'recurring', null]);
    expect(events[2].cancelled).toBe(true);
  });
});

describe('booking titles', () => {
  it('splits client from one or more services', () => {
    expect(parseBookingTitle('Jen Rivera — Acrylic Fill — Short')).toEqual({
      client: 'Jen Rivera',
      services: ['Acrylic Fill — Short']
    });
    expect(
      parseBookingTitle('Jamiyla Hills – Acrylic Full Set - Short, Kouture Classic Manicure')
    ).toEqual({
      client: 'Jamiyla Hills',
      services: ['Acrylic Full Set — Short', 'Kouture Classic Manicure']
    });
    expect(parseBookingTitle('Dentist')).toBeNull();
    expect(parseBookingTitle('Re-pot plants')).toBeNull();
  });

  it('matches the longest menu name, ignoring length suffixes', () => {
    expect(matchService('Acrylic Full Set — Short', MENU)?.id).toBe('svc_full');
    expect(matchService('acrylic fill - long', MENU)?.id).toBe('svc_fill');
    expect(matchService('Chrome French', MENU)).toBeNull();
    expect(matchService('Acrylic Fillings', MENU)).toBeNull();
  });
});

describe('planSync', () => {
  const event = (uid: string, summary: string, start: string, extra = {}) => ({
    uid,
    summary,
    start,
    end: new Date(Date.parse(start) + 90 * 60_000).toISOString(),
    description: null,
    cancelled: false,
    unsupported: null,
    ...extra
  });
  const stored = (over: Partial<ExistingAppointment>): ExistingAppointment => ({
    id: 'apt_1',
    externalRef: 'u1',
    clientId: 'cli_jen',
    serviceId: 'svc_fill',
    clientLabel: 'Jen Rivera',
    serviceLabel: 'Acrylic Fill — Short',
    startsAt: '2026-11-25T16:00:00.000Z',
    endsAt: '2026-11-25T17:30:00.000Z',
    status: 'booked',
    priceCents: 5500,
    ...over
  });
  const clients = [{ id: 'cli_jen', fullName: 'Jen Rivera' }];

  it('adds new bookings, priced from the menu, creating unknown clients once', () => {
    const plan = planSync({
      events: [
        event('u1', 'Jen Rivera — Acrylic Fill — Short', '2026-11-25T16:00:00Z'),
        event(
          'u2',
          'Jamiyla Hills — Acrylic Full Set — Short, Kouture Classic Manicure',
          '2026-11-25T18:00:00Z'
        ),
        event('u3', 'jamiyla hills — Chrome French', '2026-11-26T18:00:00Z'),
        event('u4', 'Supply pickup', '2026-11-26T14:00:00Z')
      ],
      existing: [],
      clients,
      services: MENU,
      now: NOW
    });
    expect(plan.newClients).toEqual(['Jamiyla Hills']);
    expect(plan.inserts).toHaveLength(3);
    expect(plan.inserts[0]).toMatchObject({
      clientId: 'cli_jen',
      serviceId: 'svc_fill',
      priceCents: 5500
    });
    expect(plan.inserts[1]).toMatchObject({
      clientId: null,
      serviceId: 'svc_full',
      priceCents: 11000,
      depositCents: 2500
    });
    // Unknown service: imported, flagged by a zero price for the owner to set.
    expect(plan.inserts[2]).toMatchObject({ serviceId: null, priceCents: 0 });
    expect(plan.skipped).toEqual([{ uid: 'u4', reason: 'not a booking' }]);
  });

  it('is idempotent: an unchanged feed produces no writes', () => {
    const plan = planSync({
      events: [event('u1', 'Jen Rivera — Acrylic Fill — Short', '2026-11-25T16:00:00.000Z')],
      existing: [stored({})],
      clients,
      services: MENU,
      now: NOW
    });
    expect(plan).toMatchObject({ inserts: [], updates: [], cancels: [], newClients: [] });
  });

  it('follows reschedules and cancellations but keeps owner-set prices and outcomes', () => {
    const plan = planSync({
      events: [
        event('u1', 'Jen Rivera — Acrylic Fill — Short', '2026-11-27T16:00:00.000Z'),
        event('u2', 'Jen Rivera — Acrylic Fill — Short', '2026-11-28T16:00:00.000Z', {
          cancelled: true
        }),
        event('u3', 'Jen Rivera — Acrylic Fill — Short', '2026-11-20T16:00:00.000Z')
      ],
      existing: [
        stored({ priceCents: 6000 }),
        stored({
          id: 'apt_2',
          externalRef: 'u2',
          startsAt: '2026-11-28T16:00:00.000Z',
          endsAt: '2026-11-28T17:30:00.000Z'
        }),
        stored({
          id: 'apt_3',
          externalRef: 'u3',
          status: 'completed',
          startsAt: '2026-11-20T16:00:00.000Z',
          endsAt: '2026-11-20T17:30:00.000Z'
        })
      ],
      clients,
      services: MENU,
      now: NOW
    });
    expect(plan.updates).toEqual([
      {
        id: 'apt_1',
        patch: { startsAt: '2026-11-27T16:00:00.000Z', endsAt: '2026-11-27T17:30:00.000Z' }
      },
      { id: 'apt_2', patch: { status: 'cancelled' } }
    ]);
  });

  it('cancels upcoming bookings that disappeared, never past ones, never on an empty feed', () => {
    const existing = [
      stored({ id: 'gone_future', externalRef: 'x1', startsAt: '2026-12-01T16:00:00.000Z' }),
      stored({ id: 'gone_past', externalRef: 'x2', startsAt: '2026-11-20T16:00:00.000Z' }),
      stored({ id: 'manual', externalRef: null, startsAt: '2026-12-01T16:00:00.000Z' })
    ];
    const withFeed = planSync({
      events: [event('u9', 'Jen Rivera — Acrylic Fill', '2026-11-26T16:00:00Z')],
      existing,
      clients,
      services: MENU,
      now: NOW
    });
    expect(withFeed.cancels).toEqual(['gone_future']);
    const empty = planSync({ events: [], existing, clients, services: MENU, now: NOW });
    expect(empty.cancels).toEqual([]);
  });

  it('reads the preview feed end to end', () => {
    const events = parseIcs(demoFeed(NOW, TZ), TZ);
    const plan = planSync({ events, existing: [], clients, services: MENU, now: NOW });
    expect(events).toHaveLength(6);
    expect(plan.inserts.length).toBe(4);
    expect(plan.skipped).toHaveLength(1);
  });
});
