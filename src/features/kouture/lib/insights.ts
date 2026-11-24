import { addDays, dayKey, startOfMonth } from '@/lib/dates';
import type { Appointment, Expense, Payment } from '@/server/data/types';

import { signedAmount } from './summary';

// Pure business maths for the Kouture modules: client history, retention,
// profit by month and service/booking analytics. Pages pass in plain rows.

export type ClientLike = { id: string; fullName: string; birthday: string | null };
export type PaymentWithClient = Payment & { clientId: string | null };

export type ClientHistory = {
  visits: number;
  noShows: number;
  lastVisit: string | null;
  nextVisit: string | null;
  spendCents: number;
  /** Average days between completed visits, when there are at least two. */
  cadenceDays: number | null;
  lastService: string | null;
};

const DAY_MS = 86_400_000;

export function clientHistories(
  appointments: Appointment[],
  payments: PaymentWithClient[],
  now: Date
): Map<string, ClientHistory> {
  const nowIso = now.toISOString();
  const out = new Map<string, ClientHistory>();
  const get = (id: string) => {
    let h = out.get(id);
    if (!h) {
      h = {
        visits: 0,
        noShows: 0,
        lastVisit: null,
        nextVisit: null,
        spendCents: 0,
        cadenceDays: null,
        lastService: null
      };
      out.set(id, h);
    }
    return h;
  };
  const visitTimes = new Map<string, number[]>();
  const sorted = appointments.toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const a of sorted) {
    if (!a.clientId) continue;
    const h = get(a.clientId);
    if (a.status === 'completed') {
      h.visits++;
      h.lastVisit = a.startsAt;
      h.lastService = a.serviceName;
      visitTimes.set(a.clientId, [...(visitTimes.get(a.clientId) ?? []), Date.parse(a.startsAt)]);
    } else if (a.status === 'no_show') {
      h.noShows++;
    } else if (a.status !== 'cancelled' && a.startsAt > nowIso && !h.nextVisit) {
      h.nextVisit = a.startsAt;
    }
  }
  for (const p of payments) {
    if (p.clientId) get(p.clientId).spendCents += signedAmount(p);
  }
  for (const [id, times] of visitTimes) {
    if (times.length < 2) continue;
    get(id).cadenceDays = Math.round((times.at(-1)! - times[0]) / DAY_MS / (times.length - 1));
  }
  return out;
}

export type RetentionBucket = 'due' | 'lapsed' | 'lost';
export type RetentionEntry = {
  clientId: string;
  fullName: string;
  bucket: RetentionBucket;
  daysSince: number;
  lastService: string | null;
};

/**
 * Who to reach out to. "Due" = past their usual rhythm (or 3 weeks, the
 * typical fill cycle) with nothing booked; "lapsed" = 6+ weeks; "lost" = 4+ months.
 */
export function retentionList(
  clients: ClientLike[],
  histories: Map<string, ClientHistory>,
  now: Date
): RetentionEntry[] {
  const out: RetentionEntry[] = [];
  for (const c of clients) {
    const h = histories.get(c.id);
    if (!h?.lastVisit || h.nextVisit) continue;
    const daysSince = Math.floor((now.getTime() - Date.parse(h.lastVisit)) / DAY_MS);
    const rhythm = Math.min(Math.max(h.cadenceDays ?? 21, 14), 42);
    const bucket: RetentionBucket | null =
      daysSince >= 120 ? 'lost' : daysSince >= 42 ? 'lapsed' : daysSince >= rhythm ? 'due' : null;
    if (bucket) {
      out.push({
        clientId: c.id,
        fullName: c.fullName,
        bucket,
        daysSince,
        lastService: h.lastService
      });
    }
  }
  return out.toSorted((a, b) => a.daysSince - b.daysSince);
}

export function birthdaysWithin(clients: ClientLike[], today: string, days: number) {
  const window = new Map<string, number>();
  for (let i = 0; i <= days; i++) window.set(addDays(today, i).slice(5), i);
  return clients
    .filter((c) => c.birthday && window.has(c.birthday.slice(5)))
    .map((c) => ({ ...c, inDays: window.get((c.birthday as string).slice(5)) as number }))
    .toSorted((a, b) => a.inDays - b.inDays);
}

export type MonthLine = {
  month: string;
  serviceCents: number;
  tipCents: number;
  refundCents: number;
  expenseCents: number;
  profitCents: number;
  visits: number;
};

/** Money in and out per calendar month (owner's timezone), oldest first. */
export function monthlyProfit(
  months: string[],
  payments: Payment[],
  expenses: Expense[],
  appointments: Appointment[],
  timeZone: string
): MonthLine[] {
  const lines = new Map(
    months.map((m) => [
      m,
      {
        month: m,
        serviceCents: 0,
        tipCents: 0,
        refundCents: 0,
        expenseCents: 0,
        profitCents: 0,
        visits: 0
      }
    ])
  );
  for (const p of payments) {
    const line = lines.get(startOfMonth(dayKey(new Date(p.receivedAt), timeZone)));
    if (!line) continue;
    if (p.kind === 'tip') line.tipCents += p.amountCents;
    else if (p.kind === 'refund') line.refundCents += p.amountCents;
    else line.serviceCents += p.amountCents;
  }
  for (const e of expenses) {
    const line = lines.get(startOfMonth(e.spentOn));
    if (line) line.expenseCents += e.amountCents;
  }
  for (const a of appointments) {
    if (a.status !== 'completed') continue;
    const line = lines.get(startOfMonth(dayKey(new Date(a.startsAt), timeZone)));
    if (line) line.visits++;
  }
  for (const line of lines.values()) {
    line.profitCents = line.serviceCents + line.tipCents - line.refundCents - line.expenseCents;
  }
  return [...lines.values()];
}

export function topServices(appointments: Appointment[], limit = 6) {
  const by = new Map<string, { name: string; count: number; revenueCents: number }>();
  for (const a of appointments) {
    if (a.status !== 'completed') continue;
    // "Acrylic Fill — Short" and "Acrylic Fill — Long" are the same service.
    const name = a.serviceName.split(/\s+[—–-]\s+|,/)[0].trim() || 'Service';
    const row = by.get(name) ?? { name, count: 0, revenueCents: 0 };
    row.count++;
    row.revenueCents += a.priceCents;
    by.set(name, row);
  }
  return [...by.values()].toSorted((a, b) => b.revenueCents - a.revenueCents).slice(0, limit);
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function bookingsByWeekday(appointments: Appointment[], timeZone: string) {
  const counts = WEEKDAYS.map((day) => ({ day, count: 0 }));
  for (const a of appointments) {
    if (a.status === 'cancelled') continue;
    const key = dayKey(new Date(a.startsAt), timeZone);
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    counts[(weekday + 6) % 7].count++;
  }
  return counts;
}

/** Share of recently seen clients who already have their next visit booked. */
export function rebookRate(histories: Map<string, ClientHistory>, now: Date, days = 60) {
  const since = now.getTime() - days * DAY_MS;
  let seen = 0;
  let rebooked = 0;
  for (const h of histories.values()) {
    if (!h.lastVisit || Date.parse(h.lastVisit) < since) continue;
    seen++;
    if (h.nextVisit) rebooked++;
  }
  return seen ? rebooked / seen : 0;
}

/** New vs returning clients per month: "new" = first completed visit that month. */
export function newVsReturning(months: string[], appointments: Appointment[], timeZone: string) {
  const firstVisit = new Map<string, string>();
  const visitorsByMonth = new Map<string, Set<string>>();
  for (const a of appointments.toSorted((x, y) => x.startsAt.localeCompare(y.startsAt))) {
    if (a.status !== 'completed' || !a.clientId) continue;
    const month = startOfMonth(dayKey(new Date(a.startsAt), timeZone));
    if (!firstVisit.has(a.clientId)) firstVisit.set(a.clientId, month);
    visitorsByMonth.set(month, (visitorsByMonth.get(month) ?? new Set()).add(a.clientId));
  }
  return months.map((month) => {
    const visitors = [...(visitorsByMonth.get(month) ?? [])];
    const fresh = visitors.filter((id) => firstVisit.get(id) === month).length;
    return { month, newClients: fresh, returning: visitors.length - fresh };
  });
}

export function monthLabel(month: string, style: 'short' | 'long' = 'short') {
  return new Intl.DateTimeFormat('en-US', {
    month: style,
    year: style === 'long' ? 'numeric' : undefined,
    timeZone: 'UTC'
  }).format(new Date(`${month}T12:00:00Z`));
}
