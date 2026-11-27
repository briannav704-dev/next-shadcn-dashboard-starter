import { describe, expect, it } from 'vitest';

import { type TeamSnapshot, quickAnswer, runTeam } from '@/features/team/rules';
import type { Appointment } from '@/server/data/types';

const TZ = 'America/New_York';
const NOW = new Date('2026-11-24T15:00:00Z'); // Tue 10am in New York
const iso = (daysFromNow: number, hour = 15) =>
  new Date(Date.UTC(2026, 10, 24 + daysFromNow, hour)).toISOString();

let seq = 0;
function appt(clientId: string, daysFromNow: number, over: Partial<Appointment> = {}): Appointment {
  const startsAt = iso(daysFromNow);
  return {
    id: `a${seq++}`,
    clientId,
    clientName: clientId,
    serviceName: 'Acrylic Fill — Short',
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + 90 * 60_000).toISOString(),
    status: daysFromNow < 0 ? 'completed' : 'booked',
    priceCents: 5500,
    depositCents: 1500,
    source: 'nailzy',
    ...over
  };
}

function client(id: string, over: Partial<TeamSnapshot['clients'][number]> = {}) {
  return {
    id,
    fullName: `${id[0].toUpperCase()}${id.slice(1)} Doe`,
    phone: '555-0100',
    birthday: null,
    smsMarketingConsentAt: '2026-01-01T00:00:00Z',
    smsOptedOutAt: null,
    emailMarketingConsentAt: null,
    emailOptedOutAt: null,
    ...over
  };
}

function snapshot(over: Partial<TeamSnapshot> = {}): TeamSnapshot {
  return {
    now: NOW,
    timeZone: TZ,
    appointments: [],
    payments: [],
    expenses: [],
    clients: [],
    inventory: [],
    marketing: [
      {
        id: 'm1',
        title: 'Chrome carousel',
        channel: 'instagram',
        status: 'idea',
        scheduledOn: '2026-11-27',
        caption: null
      }
    ],
    taxPayments: [],
    calendar: { connected: false, lastRun: null },
    pendingApprovals: 0,
    bookingUrl: 'https://example.com/book',
    ...over
  };
}

const keys = (r: ReturnType<typeof runTeam>) => r.findings.map((f) => f.sourceKey);

describe('operations', () => {
  it('flags finished visits to check out, urgently once they are days old', () => {
    const r = runTeam(snapshot({ appointments: [appt('ava', -1, { status: 'booked' })] }));
    expect(r.findings.find((f) => f.sourceKey === 'ops:checkout')).toMatchObject({
      title: '1 visit to check out',
      severity: 'attention'
    });
    const old = runTeam(snapshot({ appointments: [appt('ava', -4, { status: 'confirmed' })] }));
    expect(old.findings.find((f) => f.sourceKey === 'ops:checkout')?.severity).toBe('urgent');
  });

  it('flags unpriced bookings and a stale or failed calendar sync', () => {
    const r = runTeam(
      snapshot({
        appointments: [appt('ava', 2, { priceCents: 0, serviceName: 'Chrome French — Long' })],
        calendar: { connected: true, lastRun: { ranAt: '2026-11-22T10:00:00Z', ok: true } }
      })
    );
    expect(keys(r)).toEqual(expect.arrayContaining(['ops:unpriced', 'ops:sync']));
    expect(r.findings.find((f) => f.sourceKey === 'ops:unpriced')?.detail).toContain(
      'Chrome French'
    );
  });
});

describe('client relations', () => {
  it('drafts win-back texts only for consenting clients with a phone', () => {
    const r = runTeam(
      snapshot({
        appointments: [appt('ava', -30), appt('bea', -30), appt('cam', -30), appt('dee', -30)],
        clients: [
          client('ava'),
          client('bea', { smsMarketingConsentAt: null }),
          client('cam', { smsOptedOutAt: '2026-06-01T00:00:00Z' }),
          client('dee', { phone: null })
        ]
      })
    );
    const draft = r.drafts.find((d) => d.agent === 'client_relations');
    expect(draft).toMatchObject({ actionType: 'send_message', sourceKey: 'cr:winback:2026-11-23' });
    expect(draft?.payload.recipients).toEqual([{ clientId: 'ava', name: 'Ava Doe' }]);
    expect(String(draft?.payload.body)).toContain('Reply STOP');
  });

  it('warns about repeat no-shows who are booked again', () => {
    const r = runTeam(
      snapshot({
        appointments: [
          appt('eve', -20, { status: 'no_show' }),
          appt('eve', -10, { status: 'no_show' }),
          appt('eve', 3)
        ],
        clients: [client('eve')]
      })
    );
    expect(keys(r)).toContain('cr:noshow:eve');
  });
});

describe('inventory, finance and marketing', () => {
  it('drafts a restock order for low items with estimated cost', () => {
    const r = runTeam(
      snapshot({
        inventory: [
          {
            id: 'i1',
            name: 'Builder gel',
            unit: 'jar',
            onHand: 1,
            reorderAt: 2,
            unitCostCents: 2400,
            supplier: 'Co'
          },
          {
            id: 'i2',
            name: 'Tips',
            unit: 'box',
            onHand: 9,
            reorderAt: 2,
            unitCostCents: 1000,
            supplier: null
          }
        ]
      })
    );
    expect(r.findings.find((f) => f.sourceKey === 'inv:low')?.title).toBe('1 item running low');
    expect(r.drafts.find((d) => d.agent === 'inventory_manager')?.payload).toMatchObject({
      estimatedCents: 3 * 2400
    });
  });

  it('reminds about an estimated tax payment due soon, minus what is paid', () => {
    const at = new Date('2026-09-02T15:00:00Z');
    const payments = [
      {
        id: 'p',
        appointmentId: null,
        clientId: null,
        kind: 'balance' as const,
        method: 'cash' as const,
        amountCents: 1_000_000,
        receivedAt: '2026-07-10T18:00:00Z'
      }
    ];
    const r = runTeam(snapshot({ now: at, payments }));
    const tax = r.findings.find((f) => f.sourceKey === 'fin:tax:2026-Q3');
    expect(tax?.title).toBe('Q3 estimated tax due Tue, Sep 15');
    const paid = runTeam(
      snapshot({
        now: at,
        payments,
        taxPayments: [{ taxYear: 2026, quarter: 3, amountCents: 1_000_000 }]
      })
    );
    expect(keys(paid)).not.toContain('fin:tax:2026-Q3');
  });

  it('notices an empty content week and late posts, and drafts ready posts', () => {
    const r = runTeam(
      snapshot({
        marketing: [
          {
            id: 'late',
            title: 'Old reel',
            channel: 'tiktok',
            status: 'drafting',
            scheduledOn: '2026-11-20',
            caption: null
          },
          {
            id: 'go',
            title: 'Gift cards',
            channel: 'instagram',
            status: 'ready',
            scheduledOn: '2026-11-25',
            caption: 'Hi'
          }
        ]
      })
    );
    expect(keys(r)).toContain('mkt:late');
    expect(r.drafts.find((d) => d.sourceKey === 'mkt:publish:go')?.actionType).toBe(
      'publish_content'
    );
    const empty = runTeam(snapshot({ marketing: [] }));
    expect(keys(empty)).toContain('mkt:empty:2026-11-23');
  });
});

describe('ceo briefing and quick answers', () => {
  it('leads with the most urgent items across the team', () => {
    const r = runTeam(
      snapshot({
        appointments: [appt('ava', -4, { status: 'booked' })],
        inventory: [
          {
            id: 'i',
            name: 'Gel',
            unit: 'jar',
            onHand: 0,
            reorderAt: 1,
            unitCostCents: null,
            supplier: null
          }
        ]
      })
    );
    const lines = r.briefings.ceo.split('\n');
    expect(lines[0]).toBe('Today’s priorities:');
    expect(lines[1]).toContain('1 visit to check out (Olivia)');
    expect(lines[2]).toContain('out of stock (Ivy)');
  });

  it('spreads the top three across team members', () => {
    const r = runTeam(
      snapshot({
        appointments: [
          ...['eve', 'fay', 'gus'].flatMap((c) => [
            appt(c, -20, { status: 'no_show' }),
            appt(c, -10, { status: 'no_show' }),
            appt(c, 3)
          ]),
          appt('ava', -1, { status: 'booked' })
        ],
        clients: ['eve', 'fay', 'gus', 'ava'].map((id) => client(id))
      })
    );
    const lines = r.briefings.ceo.split('\n').slice(1, 4);
    expect(lines.some((l) => l.includes('(Olivia)'))).toBe(true);
    expect(lines.filter((l) => l.includes('(Camille)')).length).toBeLessThan(3);
  });

  it('is stable: the same data gives the same findings', () => {
    const s = snapshot({ appointments: [appt('ava', -1, { status: 'booked' })] });
    expect(runTeam(s)).toEqual(runTeam(s));
  });

  it('answers quick questions from the agent’s own list', () => {
    expect(quickAnswer('needs', { open: [], done: [], briefing: null })).toBe(
      'Nothing needs you from me right now.'
    );
    expect(
      quickAnswer('needs', { open: [{ title: 'A', detail: 'b' }], done: [], briefing: null })
    ).toBe('1. A: b');
  });
});
