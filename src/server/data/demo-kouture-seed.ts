import 'server-only';

import { addDays, startOfDayInZone } from '@/lib/dates';
import type { DemoRow, DemoTables } from '@/server/entities/demo-collection';

/** Sample Kouture Nail Bar data, relative to `today`, for the local preview only. */
export function seedKoutureTables(opts: {
  today: string;
  timeZone: string;
  rand: () => number;
  id: (prefix: string) => string;
}): DemoTables {
  const { today, timeZone, rand, id } = opts;
  const at = (day: string, hour: number) =>
    new Date(startOfDayInZone(day, timeZone).getTime() + hour * 3_600_000).toISOString();

  const services: DemoRow[] = (
    [
      ['Acrylic Full Set', 'extensions', 120, 7500, 2500],
      ['Acrylic Fill', 'fill', 90, 5500, 1500],
      ['Gel-X Full Set', 'extensions', 120, 8500, 2500],
      ['Structured Gel Manicure', 'manicure', 90, 6000, 2000],
      ['Kouture Classic Manicure', 'manicure', 45, 3500, 1000],
      ['Luxe Pedicure', 'pedicure', 60, 6500, 2000],
      ['Signature Nail Art', 'nail_art', 30, 2500, 0],
      ['Soak-off Removal', 'removal', 30, 1500, 0]
    ] as const
  ).map(([name, category, durationMinutes, priceCents, depositCents]) => ({
    id: id('svc'),
    name,
    category,
    description: null,
    durationMinutes,
    priceCents,
    depositCents,
    active: true,
    createdAt: at(addDays(today, -500), 9)
  }));
  const bookable = services.slice(0, 6);

  const names = [
    'Amara Wells',
    'Bianca Reyes',
    'Chloe Martin',
    'Daniela Cruz',
    'Eden Park',
    'Faith Okafor',
    'Gia Romano',
    'Hailey Brooks',
    'Imani Carter',
    'Jasmine Lee',
    'Kayla Nguyen',
    'Layla Hassan',
    'Maya Thompson',
    'Nia Johnson',
    'Olivia Grant',
    'Priya Shah',
    'Quinn Adams',
    'Riley Morgan',
    'Sofia Alvarez',
    'Tiana Brown',
    'Uma Patel',
    'Valentina Ruiz',
    'Whitney Cole',
    'Zoe Kim'
  ];
  const clients: DemoRow[] = names.map((fullName, i) => {
    const handle = fullName.toLowerCase().replace(/[^a-z]/g, '');
    const consent = i % 3 !== 0 ? at(addDays(today, -300 + i * 10), 12) : null;
    return {
      id: id('cli'),
      fullName,
      phone: `555-01${String(i).padStart(2, '0')}`,
      email: `${handle}@example.com`,
      instagram: i % 2 === 0 ? `@${handle}` : null,
      birthday: `199${i % 10}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
      allergies: i === 4 ? 'Sensitive to HEMA — use hypoallergenic gel' : null,
      notes: null,
      source: i % 4 === 0 ? 'manual' : 'nailzy',
      smsMarketingConsentAt: consent,
      emailMarketingConsentAt: consent,
      smsOptedOutAt: i === 7 ? at(addDays(today, -20), 12) : null,
      emailOptedOutAt: null,
      createdAt: at(addDays(today, -400 + i * 15), 12)
    };
  });

  const appointments: DemoRow[] = [];
  const payments: DemoRow[] = [];
  const slotHours = [10, 12.5, 15, 17.5];
  for (let offset = -120; offset <= 14; offset++) {
    const day = addDays(today, offset);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 1) continue; // closed Sunday & Monday
    for (const hour of slotHours) {
      if (rand() > (offset > 0 ? 0.55 : 0.78)) continue;
      const service = bookable[Math.floor(rand() * bookable.length)];
      // Early clients in the list lapse, so retention has something to show.
      const pool = offset > -50 ? clients.slice(4) : clients;
      const client = pool[Math.floor(rand() * pool.length)];
      const startsAt = at(day, hour);
      let status = 'booked';
      if (offset < 0) {
        const r = rand();
        status = r < 0.05 ? 'no_show' : r < 0.09 ? 'cancelled' : 'completed';
      } else if (offset === 0) {
        status = hour < 12 ? 'completed' : 'confirmed';
      } else if (rand() < 0.5) {
        status = 'confirmed';
      }
      const fromNailzy = rand() < 0.85;
      const appt: DemoRow = {
        id: id('apt'),
        clientId: client.id,
        serviceId: service.id,
        clientLabel: client.fullName,
        serviceLabel: service.name,
        startsAt,
        endsAt: new Date(
          new Date(startsAt).getTime() + (service.durationMinutes as number) * 60_000
        ).toISOString(),
        status,
        priceCents: service.priceCents,
        depositCents: service.depositCents,
        source: fromNailzy ? 'nailzy' : 'manual',
        // No calendar UID: these predate the calendar sync, so it leaves them alone.
        externalRef: null,
        notes: null
      };
      appointments.push(appt);
      const bookedAt = new Date(new Date(startsAt).getTime() - (2 + rand() * 12) * 86_400_000);
      const pay = (kind: string, method: string, amountCents: number, receivedAt: string) =>
        payments.push({
          id: id('pay'),
          appointmentId: appt.id,
          clientId: client.id,
          kind,
          method,
          amountCents,
          receivedAt,
          notes: null
        });
      if (status !== 'cancelled' && (service.depositCents as number) > 0) {
        pay('deposit', 'stripe', service.depositCents as number, bookedAt.toISOString());
      }
      if (status === 'completed') {
        pay(
          'balance',
          'cash',
          (service.priceCents as number) - (service.depositCents as number),
          appt.endsAt as string
        );
        if (rand() < 0.6) {
          pay('tip', 'cash', Math.round((10 + rand() * 15) * 100), appt.endsAt as string);
        }
      }
    }
  }

  const expenses: DemoRow[] = [];
  for (let m = 0; m < 5; m++) {
    const base = `${addDays(today, -30 * m).slice(0, 7)}-`;
    const add = (category: string, vendor: string, amountCents: number, dayOfMonth: string) => {
      const spentOn = `${base}${dayOfMonth}`;
      if (spentOn > today) return;
      expenses.push({
        id: id('exp'),
        category,
        vendor,
        description: null,
        amountCents,
        spentOn
      });
    };
    add('rent', 'Suite rental', 95000, '01');
    add('software', 'Nailzy', 3900, '03');
    add('supplies', 'Gel polish restock', 18400 + m * 1200, '08');
    add('marketing', 'Instagram promotion', 6000, '12');
    add('fees', 'Stripe fees', 4200 + m * 300, '15');
  }

  const inventory: DemoRow[] = (
    [
      ['Builder gel — clear', 'gel', 'jar', 2, 3, 2400, 'Nail supply co.'],
      ['No-wipe top coat', 'gel', 'bottle', 1, 2, 1600, 'Nail supply co.'],
      ['Acrylic powder — pink', 'acrylic', 'jar', 4, 2, 3200, 'Nail supply co.'],
      ['Monomer liquid', 'acrylic', 'bottle', 3, 1, 4500, 'Nail supply co.'],
      ['Coffin tips (box)', 'disposables', 'box', 6, 2, 1200, 'Amazon'],
      ['Nitrile gloves', 'sanitation', 'box', 1, 2, 1100, 'Amazon'],
      ['Chrome powder set', 'nail_art', 'set', 2, 1, 1800, 'Etsy shop'],
      ['Cuticle oil (retail)', 'retail', 'bottle', 14, 5, 400, 'Private label']
    ] as const
  ).map(([name, category, unit, onHand, reorderAt, unitCostCents, supplier]) => ({
    id: id('inv'),
    name,
    category,
    unit,
    onHand,
    reorderAt,
    unitCostCents,
    supplier,
    notes: null,
    archived: false
  }));

  const marketing: DemoRow[] = (
    [
      ['Holiday chrome collection carousel', 'instagram', 'post', 3, 'ready'],
      ['Fill-in-a-minute timelapse', 'tiktok', 'reel', 5, 'drafting'],
      ['Gift card promo', 'instagram', 'promo', 8, 'idea'],
      ['New Year new set: 10% off', 'sms', 'message', 12, 'idea'],
      ['Client spotlight story', 'instagram', 'story', -2, 'published'],
      ['Nail care tips reel', 'tiktok', 'reel', -6, 'published'],
      ['Valentine’s sets preview', 'instagram', 'campaign', 40, 'idea']
    ] as const
  ).map(([title, channel, kind, day, status]) => ({
    id: id('mkt'),
    title,
    channel,
    kind,
    scheduledOn: addDays(today, day),
    status,
    caption: null,
    notes: null
  }));

  const policies: DemoRow[] = (
    [
      [
        'Deposits',
        'A non-refundable deposit is required to book every appointment and is paid by card through Nailzy. It goes toward your total; the remaining balance is paid in cash at your appointment.'
      ],
      [
        'Cancellations & rescheduling',
        'Please give at least 24 hours’ notice to cancel or reschedule. With notice, your deposit moves to your new date once. Without notice, the deposit is forfeited.'
      ],
      [
        'Late arrivals',
        'Arriving more than 15 minutes late may mean a shortened service or a reschedule, and the deposit is forfeited.'
      ],
      [
        'No-shows',
        'Missed appointments forfeit the deposit. After two no-shows, a full prepayment is required to book.'
      ],
      [
        'Fixes',
        'Lifting or breaks within 5 days are fixed free of charge. After 5 days, repairs are charged per nail.'
      ]
    ] as const
  ).map(([title, body], i) => ({ id: id('pol'), title, body, sortOrder: i }));

  const notes: DemoRow[] = [
    {
      id: id('cnt'),
      clientId: clients[4].id,
      body: 'Loves almond shape, medium length. Prefers neutral tones with chrome.',
      createdAt: at(addDays(today, -40), 13)
    },
    {
      id: id('cnt'),
      clientId: clients[5].id,
      body: 'Always books with her sister. Ask about her wedding in March!',
      createdAt: at(addDays(today, -12), 15)
    }
  ];

  return {
    'kouture.services': services,
    'kouture.clients': clients,
    'kouture.client_notes': notes,
    'kouture.appointments': appointments,
    'kouture.payments': payments,
    'kouture.expenses': expenses,
    'kouture.inventory_items': inventory,
    'kouture.marketing_items': marketing,
    'kouture.policies': policies,
    'kouture.sync_runs': []
  };
}
