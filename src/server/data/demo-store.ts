import 'server-only';

import { DEFAULT_TIMEZONE, addDays, startOfDayInZone, todayKey } from '@/lib/dates';
import { AppError } from '@/server/errors';

import type {
  Appointment,
  AppointmentStatus,
  Approval,
  AuditEntry,
  Domain,
  Expense,
  Goal,
  Habit,
  LifeEvent,
  Payment,
  Repositories,
  Task
} from './types';

// Sample-data mode: an in-memory store seeded relative to "today" so the app is
// explorable before Supabase exists. It applies the same rules the database
// enforces (approval transitions, frozen payloads, audit on every write).
// Nothing here is persisted.

const TZ = DEFAULT_TIMEZONE;

type HabitRow = { id: string; name: string; targetPerWeek: number; logs: Set<string> };

type DemoState = {
  tasks: Task[];
  habits: HabitRow[];
  events: LifeEvent[];
  goals: Goal[];
  appointments: Appointment[];
  payments: Payment[];
  expenses: Expense[];
  clients: { id: string; fullName: string; createdAt: string }[];
  approvals: Approval[];
  audit: AuditEntry[];
  seq: number;
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const SERVICES = [
  { name: 'Gel-X Full Set', minutes: 120, price: 8500, deposit: 2500 },
  { name: 'Structured Gel Manicure', minutes: 90, price: 6000, deposit: 2000 },
  { name: 'Acrylic Full Set', minutes: 120, price: 7500, deposit: 2500 },
  { name: 'Fill & Refresh', minutes: 75, price: 5500, deposit: 1500 },
  { name: 'Luxe Pedicure', minutes: 60, price: 6500, deposit: 2000 },
  { name: 'Signature Nail Art Set', minutes: 150, price: 11000, deposit: 3000 }
];

const CLIENT_NAMES = [
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

const SLOT_HOURS = [10, 12.5, 15, 17.5];

function seed(): DemoState {
  const today = todayKey(TZ);
  const rand = rng(20261124);
  let seq = 1;
  const id = (prefix: string) => `${prefix}_${(seq++).toString(36)}`;
  const at = (day: string, hour: number) =>
    new Date(startOfDayInZone(day, TZ).getTime() + hour * 3_600_000).toISOString();

  const clients = CLIENT_NAMES.map((fullName, i) => ({
    id: id('cli'),
    fullName,
    createdAt: at(addDays(today, -400 + i * 15), 12)
  }));

  const appointments: Appointment[] = [];
  const payments: Payment[] = [];
  for (let offset = -62; offset <= 10; offset++) {
    const day = addDays(today, offset);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 1) continue; // closed Sunday & Monday
    for (const hour of SLOT_HOURS) {
      const fillRate = offset > 0 ? 0.55 : 0.78;
      if (rand() > fillRate) continue;
      const service = SERVICES[Math.floor(rand() * SERVICES.length)];
      const client = clients[Math.floor(rand() * clients.length)];
      const startsAt = at(day, hour);
      let status: AppointmentStatus = 'booked';
      if (offset < 0) {
        const r = rand();
        status = r < 0.05 ? 'no_show' : r < 0.09 ? 'cancelled' : 'completed';
      } else if (offset === 0) {
        status = hour < 12 ? 'completed' : 'confirmed';
      } else if (rand() < 0.5) {
        status = 'confirmed';
      }
      const appt: Appointment = {
        id: id('apt'),
        clientId: client.id,
        clientName: client.fullName,
        serviceName: service.name,
        startsAt,
        endsAt: new Date(new Date(startsAt).getTime() + service.minutes * 60_000).toISOString(),
        status,
        priceCents: service.price,
        depositCents: service.deposit,
        source: rand() < 0.85 ? 'nailzy' : 'manual'
      };
      appointments.push(appt);
      const bookedAt = new Date(new Date(startsAt).getTime() - (2 + rand() * 12) * 86_400_000);
      if (status !== 'cancelled') {
        payments.push({
          id: id('pay'),
          appointmentId: appt.id,
          kind: 'deposit',
          method: 'stripe',
          amountCents: service.deposit,
          receivedAt: bookedAt.toISOString()
        });
      }
      if (status === 'completed') {
        payments.push({
          id: id('pay'),
          appointmentId: appt.id,
          kind: 'balance',
          method: 'cash',
          amountCents: service.price - service.deposit,
          receivedAt: appt.endsAt
        });
        if (rand() < 0.6) {
          payments.push({
            id: id('pay'),
            appointmentId: appt.id,
            kind: 'tip',
            method: 'cash',
            amountCents: Math.round((10 + rand() * 15) * 100),
            receivedAt: appt.endsAt
          });
        }
      }
    }
  }

  const expenses: Expense[] = [];
  for (let m = 0; m < 3; m++) {
    const monthStart = addDays(today, -30 * m);
    const base = `${monthStart.slice(0, 7)}-`;
    expenses.push(
      {
        id: id('exp'),
        category: 'rent',
        vendor: 'Suite rental',
        amountCents: 95000,
        spentOn: `${base}01`
      },
      {
        id: id('exp'),
        category: 'software',
        vendor: 'Nailzy',
        amountCents: 3900,
        spentOn: `${base}03`
      },
      {
        id: id('exp'),
        category: 'supplies',
        vendor: 'Gel polish restock',
        amountCents: 18400 + m * 1200,
        spentOn: `${base}08`
      },
      {
        id: id('exp'),
        category: 'marketing',
        vendor: 'Instagram promotion',
        amountCents: 6000,
        spentOn: `${base}12`
      },
      {
        id: id('exp'),
        category: 'fees',
        vendor: 'Stripe fees',
        amountCents: 4200 + m * 300,
        spentOn: `${base}15`
      }
    );
  }

  const pastExpenses = expenses.filter((e) => e.spentOn <= today);

  const tasks: Task[] = [
    { title: 'Renew cosmetology license', dueOn: addDays(today, 6), priority: 'high' as const },
    { title: 'Book brow lamination', dueOn: addDays(today, 2), priority: 'normal' as const },
    { title: 'Order new nail art brushes', dueOn: addDays(today, 1), priority: 'normal' as const },
    { title: 'Call mom', dueOn: today, priority: 'normal' as const },
    { title: 'Plan girls trip itinerary', dueOn: addDays(today, 14), priority: 'low' as const },
    { title: 'Schedule quarterly tax payment', dueOn: addDays(today, 9), priority: 'high' as const }
  ].map((t) => ({ ...t, id: id('tsk'), status: 'open' as const, completedAt: null }));

  const habitNames: [string, number][] = [
    ['Drink 80oz water', 7],
    ['Move for 30 minutes', 5],
    ['Skincare morning & night', 7],
    ['Read 10 pages', 5],
    ['No phone first hour', 4]
  ];
  const habits: HabitRow[] = habitNames.map(([name, targetPerWeek]) => {
    const logs = new Set<string>();
    for (let i = 1; i <= 30; i++) if (rand() < targetPerWeek / 8.5) logs.add(addDays(today, -i));
    return { id: id('hab'), name, targetPerWeek, logs };
  });

  const events: LifeEvent[] = [
    {
      title: 'Pilates reformer',
      category: 'fitness' as const,
      day: today,
      hour: 7,
      len: 1,
      location: 'Core Studio'
    },
    {
      title: 'Facial',
      category: 'self_care' as const,
      day: addDays(today, 2),
      hour: 9,
      len: 1.5,
      location: 'Glow Lab'
    },
    {
      title: 'Dinner with Nia',
      category: 'social' as const,
      day: addDays(today, 3),
      hour: 19.5,
      len: 2,
      location: null
    },
    {
      title: 'Lash fill',
      category: 'self_care' as const,
      day: addDays(today, 5),
      hour: 8,
      len: 1.5,
      location: null
    },
    {
      title: 'Flight to Miami',
      category: 'travel' as const,
      day: addDays(today, 18),
      hour: 8.25,
      len: 3,
      location: 'Terminal B'
    }
  ].map((e) => ({
    id: id('evt'),
    title: e.title,
    category: e.category,
    startsAt: at(e.day, e.hour),
    endsAt: at(e.day, e.hour + e.len),
    location: e.location
  }));

  const goals: Goal[] = [
    {
      title: 'Emergency fund',
      area: 'money' as const,
      targetValue: 10000,
      currentValue: 6400,
      unit: '$',
      targetDate: addDays(today, 180)
    },
    {
      title: 'Read 24 books',
      area: 'growth' as const,
      targetValue: 24,
      currentValue: 17,
      unit: 'books',
      targetDate: `${today.slice(0, 4)}-12-31`
    },
    {
      title: 'Pilates 100 classes',
      area: 'health' as const,
      targetValue: 100,
      currentValue: 58,
      unit: 'classes',
      targetDate: null
    },
    {
      title: 'Miami trip fund',
      area: 'travel' as const,
      targetValue: 2500,
      currentValue: 1850,
      unit: '$',
      targetDate: addDays(today, 18)
    }
  ].map((g) => ({ ...g, id: id('gol'), status: 'active' as const }));

  const nowIso = new Date().toISOString();
  const expires = new Date(Date.now() + 6 * 86_400_000).toISOString();
  const approvals: Approval[] = [
    {
      id: id('apr'),
      domain: 'kouture',
      requestedBy: 'marketing_director',
      actionType: 'publish_content',
      title: 'Instagram post: holiday chrome collection',
      summary: 'Carousel of 4 chrome sets with booking link in bio. Scheduled for Friday 6pm.',
      payload: {
        channel: 'instagram',
        scheduledFor: addDays(today, 3),
        caption: 'Holiday chrome is here ✨ Book through the link in bio.'
      },
      risk: 'low',
      status: 'pending',
      decisionNote: null,
      decidedAt: null,
      expiresAt: expires,
      createdAt: nowIso
    },
    {
      id: id('apr'),
      domain: 'kouture',
      requestedBy: 'client_relations',
      actionType: 'send_message',
      title: 'Win-back text to 6 lapsed clients',
      summary:
        'Clients not seen in 60+ days who have SMS consent. Offers 10% off a fill this month.',
      payload: {
        channel: 'sms',
        recipients: 6,
        body: 'Hi {first_name}! We miss you at Kouture 💅 Enjoy 10% off a fill this month. Reply STOP to opt out.'
      },
      risk: 'medium',
      status: 'pending',
      decisionNote: null,
      decidedAt: null,
      expiresAt: expires,
      createdAt: nowIso
    },
    {
      id: id('apr'),
      domain: 'kouture',
      requestedBy: 'inventory_manager',
      actionType: 'make_purchase',
      title: 'Restock: builder gel & top coat',
      summary:
        'Projected to run out in 9 days at current pace. Estimated $142.60 from your usual supplier.',
      payload: {
        vendor: 'usual supplier',
        estimatedCents: 14260,
        items: ['Builder gel clear ×3', 'No-wipe top coat ×2']
      },
      risk: 'medium',
      status: 'pending',
      decisionNote: null,
      decidedAt: null,
      expiresAt: expires,
      createdAt: nowIso
    }
  ];

  return {
    tasks,
    habits,
    events,
    goals,
    appointments,
    payments,
    expenses: pastExpenses,
    clients,
    approvals,
    audit: [],
    seq
  };
}

const globalForDemo = globalThis as unknown as { koutureDemoStore?: DemoState };

function state(): DemoState {
  globalForDemo.koutureDemoStore ??= seed();
  return globalForDemo.koutureDemoStore;
}

function audit(
  domain: Domain,
  action: string,
  entityType: string,
  entityId: string,
  summary: string
) {
  const s = state();
  s.audit.unshift({
    id: `aud_${(s.seq++).toString(36)}`,
    occurredAt: new Date().toISOString(),
    actorType: 'owner',
    actorId: 'demo-owner',
    domain,
    action,
    entityType,
    entityId,
    summary
  });
}

function inRange(iso: string, range: { from: string; to: string }) {
  return iso >= range.from && iso < range.to;
}

export function createDemoRepositories(): Repositories {
  return {
    life: {
      async listOpenTasks(limit) {
        return state()
          .tasks.filter((t) => t.status === 'open' || isRecentlyDone(t))
          .toSorted((a, b) => (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999'))
          .slice(0, limit)
          .map((t) => ({ ...t }));
      },
      async setTaskDone(id, done) {
        const task = state().tasks.find((t) => t.id === id);
        if (!task) throw new AppError('NOT_FOUND', 'That task no longer exists.');
        task.status = done ? 'done' : 'open';
        task.completedAt = done ? new Date().toISOString() : null;
        audit(
          'life',
          'update',
          'tasks',
          id,
          `${done ? 'Completed' : 'Reopened'} task: ${task.title}`
        );
        return { ...task };
      },
      async listHabits({ fromDay, toDay }) {
        return state().habits.map((h): Habit => ({
          id: h.id,
          name: h.name,
          targetPerWeek: h.targetPerWeek,
          loggedDays: [...h.logs].filter((d) => d >= fromDay && d <= toDay).toSorted()
        }));
      },
      async setHabitLogged(habitId, day, logged) {
        const habit = state().habits.find((h) => h.id === habitId);
        if (!habit) throw new AppError('NOT_FOUND', 'That habit no longer exists.');
        if (logged) habit.logs.add(day);
        else habit.logs.delete(day);
        audit(
          'life',
          logged ? 'insert' : 'delete',
          'habit_logs',
          habitId,
          `${logged ? 'Checked in' : 'Unchecked'} habit: ${habit.name}`
        );
      },
      async listEvents(range) {
        return state()
          .events.filter((e) => inRange(e.startsAt, range))
          .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
      },
      async listActiveGoals() {
        return state().goals.filter((g) => g.status === 'active');
      }
    },
    kouture: {
      async listAppointments(range) {
        return state()
          .appointments.filter((a) => inRange(a.startsAt, range))
          .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
      },
      async listPayments(range) {
        return state().payments.filter((p) => inRange(p.receivedAt, range));
      },
      async listExpenses({ fromDay, toDay }) {
        return state().expenses.filter((e) => e.spentOn >= fromDay && e.spentOn <= toDay);
      },
      async clientStats(monthStart, lapsedBefore) {
        const s = state();
        const lastVisit = new Map<string, string>();
        for (const a of s.appointments) {
          if (a.status !== 'completed' || !a.clientId) continue;
          const prev = lastVisit.get(a.clientId);
          if (!prev || a.startsAt > prev) lastVisit.set(a.clientId, a.startsAt);
        }
        const upcoming = new Set(
          s.appointments.filter((a) => a.startsAt > new Date().toISOString()).map((a) => a.clientId)
        );
        let lapsed = 0;
        for (const c of s.clients) {
          const last = lastVisit.get(c.id);
          if (!upcoming.has(c.id) && (!last || last < lapsedBefore)) lapsed++;
        }
        return {
          total: s.clients.length,
          newThisMonth: s.clients.filter((c) => c.createdAt.slice(0, 10) >= monthStart).length,
          lapsed
        };
      }
    },
    core: {
      async getProfile() {
        return {
          id: 'demo-owner',
          email: 'owner@example.com',
          displayName: 'Beautiful',
          businessName: 'Kouture Nail Bar',
          timezone: TZ
        };
      },
      async listApprovals({ status, limit = 50 }) {
        return state()
          .approvals.filter((a) => !status || a.status === status)
          .slice(0, limit)
          .map((a) => ({ ...a }));
      },
      async countPendingApprovals() {
        return state().approvals.filter((a) => a.status === 'pending').length;
      },
      async decideApproval(id, decision, note) {
        const approval = state().approvals.find((a) => a.id === id);
        if (!approval) throw new AppError('NOT_FOUND', 'That request no longer exists.');
        if (approval.status !== 'pending') {
          throw new AppError('CONFLICT', `This request was already ${approval.status}.`);
        }
        if (approval.expiresAt < new Date().toISOString()) {
          throw new AppError('CONFLICT', 'This request has expired.');
        }
        approval.status = decision;
        approval.decisionNote = note;
        approval.decidedAt = new Date().toISOString();
        audit(
          'core',
          'update',
          'approvals',
          id,
          `${decision === 'approved' ? 'Approved' : 'Declined'}: ${approval.title}`
        );
        return { ...approval };
      },
      async listAudit({ domain, limit }) {
        return state()
          .audit.filter((e) => !domain || e.domain === domain)
          .slice(0, limit);
      }
    }
  };
}

function isRecentlyDone(task: Task) {
  return (
    task.status === 'done' &&
    task.completedAt !== null &&
    Date.now() - new Date(task.completedAt).getTime() < 12 * 3_600_000
  );
}

/** Test hook: reset the store to a fresh seed. */
export function resetDemoStore() {
  globalForDemo.koutureDemoStore = seed();
}
