import { clientConsent } from '@/features/kouture/lib/consent';
import {
  birthdaysWithin,
  bookingsByWeekday,
  clientHistories,
  rebookRate,
  retentionList,
  topServices
} from '@/features/kouture/lib/insights';
import { quarterlyDeadlines, taxYearSummary } from '@/features/kouture/lib/taxes';
import { addDays, dayKey, formatTime, startOfMonth, startOfWeek } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import type {
  AgentKey,
  AgentSeverity,
  Appointment,
  ApprovalActionType,
  Expense,
  Payment
} from '@/server/data/types';

import { AGENTS, TEAM_ORDER } from './agents';

// The rule-based team: plain checks over the salon's own data, no AI service.
// Pure, so every rule is unit-tested and a run can be repeated safely: findings
// carry stable source keys, and the caller closes tasks whose condition cleared.

export type TeamSnapshot = {
  now: Date;
  timeZone: string;
  appointments: Appointment[];
  payments: (Payment & { clientId: string | null })[];
  expenses: Expense[];
  clients: {
    id: string;
    fullName: string;
    phone: string | null;
    birthday: string | null;
    smsMarketingConsentAt: string | null;
    smsOptedOutAt: string | null;
    emailMarketingConsentAt: string | null;
    emailOptedOutAt: string | null;
  }[];
  inventory: {
    id: string;
    name: string;
    unit: string;
    onHand: number;
    reorderAt: number;
    unitCostCents: number | null;
    supplier: string | null;
  }[];
  marketing: {
    id: string;
    title: string;
    channel: string;
    status: string;
    scheduledOn: string | null;
    caption: string | null;
  }[];
  taxPayments: { taxYear: number; quarter: number; amountCents: number }[];
  calendar: { connected: boolean; lastRun: { ranAt: string; ok: boolean } | null };
  pendingApprovals: number;
  bookingUrl: string;
};

export type Finding = {
  agent: AgentKey;
  sourceKey: string;
  title: string;
  detail: string | null;
  severity: AgentSeverity;
  href: string | null;
};

export type Draft = {
  agent: AgentKey;
  sourceKey: string;
  actionType: ApprovalActionType;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  risk: 'low' | 'medium' | 'high';
};

export type TeamReport = {
  findings: Finding[];
  drafts: Draft[];
  briefings: Record<AgentKey, string>;
};

const DAY_MS = 86_400_000;
const SEVERITY_RANK: Record<AgentSeverity, number> = { urgent: 0, attention: 1, info: 2 };
const SOCIAL = new Set(['instagram', 'tiktok', 'facebook']);
const TAX_RATE = 0.15;

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function firstName(fullName: string) {
  return fullName.split(/\s+/)[0];
}

function listNames(names: string[], max = 3) {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

function shortDay(key: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${key}T12:00:00Z`));
}

const open = (a: Appointment) => a.status === 'booked' || a.status === 'confirmed';

export function runTeam(s: TeamSnapshot): TeamReport {
  const { now, timeZone: tz } = s;
  const today = dayKey(now, tz);
  const week = startOfWeek(today);
  const nowIso = now.toISOString();
  const findings: Finding[] = [];
  const drafts: Draft[] = [];
  const briefings = {} as Record<AgentKey, string>;
  const histories = clientHistories(s.appointments, s.payments, now);
  const dayOf = (iso: string) => dayKey(new Date(iso), tz);

  // ── Operations ──────────────────────────────────────────────────────────
  {
    const agent: AgentKey = 'operations_manager';
    const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();
    const toCheckOut = s.appointments.filter(
      (a) => open(a) && a.endsAt < nowIso && a.startsAt >= since
    );
    if (toCheckOut.length > 0) {
      const oldest = toCheckOut.reduce((m, a) => (a.startsAt < m ? a.startsAt : m), nowIso);
      const stale = now.getTime() - Date.parse(oldest) > 2 * DAY_MS;
      findings.push({
        agent,
        sourceKey: 'ops:checkout',
        title: `${plural(toCheckOut.length, 'visit')} to check out`,
        detail: `${listNames(toCheckOut.map((a) => a.clientName))}. Checking out records the cash balance and tip so your money reports stay right.`,
        severity: stale ? 'urgent' : 'attention',
        href: '/kouture/appointments?view=checkout'
      });
    }
    const ahead = new Date(now.getTime() + 30 * DAY_MS).toISOString();
    const unpriced = s.appointments.filter(
      (a) => open(a) && a.startsAt >= nowIso && a.startsAt <= ahead && a.priceCents === 0
    );
    if (unpriced.length > 0) {
      const services = [...new Set(unpriced.map((a) => a.serviceName.split(/\s+[—–-]\s+|,/)[0]))];
      findings.push({
        agent,
        sourceKey: 'ops:unpriced',
        title: `${plural(unpriced.length, 'booking')} without a price`,
        detail: `Add ${listNames(services)} to your service menu with the same name as in Nailzy, and the next sync prices them.`,
        severity: 'attention',
        href: '/kouture/services'
      });
    }
    const last = s.calendar.lastRun;
    if (
      s.calendar.connected &&
      (!last || !last.ok || now.getTime() - Date.parse(last.ranAt) > DAY_MS)
    ) {
      findings.push({
        agent,
        sourceKey: 'ops:sync',
        title:
          last && !last.ok ? 'Nailzy calendar sync failed' : 'Nailzy calendar not synced today',
        detail: 'Open Appointments and tap Sync now so new bookings and cancellations show up.',
        severity: last && !last.ok ? 'urgent' : 'attention',
        href: '/kouture/appointments'
      });
    }
    const todays = s.appointments.filter(
      (a) => a.status !== 'cancelled' && dayOf(a.startsAt) === today
    );
    const tomorrow = s.appointments.filter(
      (a) => a.status !== 'cancelled' && dayOf(a.startsAt) === addDays(today, 1)
    );
    const value = todays.reduce((sum, a) => sum + a.priceCents, 0);
    briefings[agent] =
      todays.length === 0
        ? `No clients booked today. Tomorrow: ${plural(tomorrow.length, 'client')}.`
        : `Today: ${plural(todays.length, 'client')}, first at ${formatTime(todays[0].startsAt, tz)}, ${formatCents(value, { whole: true })} on the books. Tomorrow: ${plural(tomorrow.length, 'client')}.`;
  }

  // ── Client relations ────────────────────────────────────────────────────
  {
    const agent: AgentKey = 'client_relations';
    const byId = new Map(s.clients.map((c) => [c.id, c]));
    const retention = retentionList(s.clients, histories, now);
    const due = retention.filter((r) => r.bucket === 'due');
    const lapsed = retention.filter((r) => r.bucket === 'lapsed');
    if (due.length + lapsed.length > 0) {
      findings.push({
        agent,
        sourceKey: 'cr:retention',
        title: `${plural(due.length, 'client')} due, ${lapsed.length} slipping away`,
        detail: `Due: ${listNames(due.map((r) => r.fullName)) || 'none'}. Slipping: ${listNames(lapsed.map((r) => r.fullName)) || 'none'}.`,
        severity: 'info',
        href: '/kouture/retention'
      });
    }
    const textable = [...due, ...lapsed]
      .map((r) => byId.get(r.clientId))
      .filter(
        (c): c is NonNullable<typeof c> =>
          Boolean(c?.phone) && clientConsent(c!).sms === 'subscribed'
      );
    if (textable.length > 0) {
      drafts.push({
        agent,
        sourceKey: `cr:winback:${week}`,
        actionType: 'send_message',
        title: `Win-back texts to ${plural(textable.length, 'client')}`,
        summary: `Clients past their usual visit with nothing booked, who agreed to marketing texts: ${listNames(
          textable.map((c) => firstName(c.fullName)),
          5
        )}.`,
        payload: {
          channel: 'sms',
          recipients: textable.map((c) => ({ clientId: c.id, name: c.fullName })),
          body: `Hi {first_name}! It’s been a little while and I’d love to see you at Kouture 💅 Book your next set here: ${s.bookingUrl} Reply STOP to opt out.`
        },
        risk: 'medium'
      });
    }
    const birthdays = birthdaysWithin(s.clients, today, 7);
    if (birthdays.length > 0) {
      findings.push({
        agent,
        sourceKey: `cr:birthdays:${week}`,
        title: `${plural(birthdays.length, 'birthday')} this week`,
        detail: birthdays
          .map(
            (b) => `${b.fullName} (${b.inDays === 0 ? 'today' : `in ${plural(b.inDays, 'day')}`})`
          )
          .join(', '),
        severity: 'info',
        href: '/kouture/retention'
      });
    }
    for (const [clientId, h] of histories) {
      const client = byId.get(clientId);
      if (!client || h.noShows < 2 || !h.nextVisit) continue;
      findings.push({
        agent,
        sourceKey: `cr:noshow:${clientId}`,
        title: `${client.fullName} has missed ${h.noShows} visits`,
        detail: `They’re booked again for ${shortDay(dayOf(h.nextVisit))}. Consider a friendly reminder, or your no-show policy.`,
        severity: 'attention',
        href: `/kouture/clients/${clientId}`
      });
    }
    briefings[agent] =
      due.length + lapsed.length === 0
        ? 'Everyone is rebooked or recently in. Lovely.'
        : `${plural(due.length, 'client')} due for their next set and ${lapsed.length} slipping away.${textable.length ? ` I drafted win-back texts for the ${textable.length} who agreed to marketing; they’re waiting for your approval.` : ''}`;
  }

  // ── Inventory ───────────────────────────────────────────────────────────
  {
    const agent: AgentKey = 'inventory_manager';
    const low = s.inventory.filter((i) => i.onHand <= i.reorderAt);
    if (low.length > 0) {
      const out = low.filter((i) => i.onHand === 0);
      findings.push({
        agent,
        sourceKey: 'inv:low',
        title: out.length
          ? `${plural(out.length, 'item')} out of stock`
          : `${plural(low.length, 'item')} running low`,
        detail: low.map((i) => `${i.name} (${i.onHand} left)`).join(', '),
        severity: out.length ? 'urgent' : 'attention',
        href: '/kouture/inventory'
      });
      const items = low.map((i) => {
        const quantity = Math.max(1, Math.ceil(i.reorderAt * 2 - i.onHand));
        return {
          name: i.name,
          quantity,
          unit: i.unit,
          supplier: i.supplier,
          estimatedCents: (i.unitCostCents ?? 0) * quantity
        };
      });
      const total = items.reduce((sum, i) => sum + i.estimatedCents, 0);
      drafts.push({
        agent,
        sourceKey: `inv:restock:${week}`,
        actionType: 'make_purchase',
        title: `Restock ${plural(items.length, 'item')}`,
        summary: `${items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}.${total ? ` About ${formatCents(total)} at your recorded costs.` : ''}`,
        payload: { items, estimatedCents: total },
        risk: 'medium'
      });
    }
    briefings[agent] =
      low.length === 0
        ? `All ${plural(s.inventory.length, 'item')} are stocked above their reorder point.`
        : `${plural(low.length, 'item')} at or below the reorder point. I drafted a restock order for your approval.`;
  }

  // ── Finance ─────────────────────────────────────────────────────────────
  {
    const agent: AgentKey = 'finance_manager';
    const year = Number(today.slice(0, 4));
    const tax = taxYearSummary({
      year,
      payments: s.payments,
      expenses: s.expenses,
      timeZone: tz,
      incomeTaxRate: TAX_RATE
    });
    const rate = tax.netProfitCents > 0 ? tax.setAsideCents / tax.netProfitCents : 0;
    // Q4 is due in January: look at last year's schedule too.
    const deadlines = [...quarterlyDeadlines(year - 1), ...quarterlyDeadlines(year)].filter(
      (q) => q.due >= today && q.due <= addDays(today, 21)
    );
    for (const q of deadlines) {
      const taxYear = Number(q.periodStart.slice(0, 4));
      if (taxYear !== year) continue; // last year's Q4 needs last year's numbers
      const quarterNet = tax.byQuarter.find((b) => b.quarter === q.quarter)?.netProfitCents ?? 0;
      const suggested = Math.max(0, Math.round(quarterNet * rate));
      const paid = s.taxPayments
        .filter((p) => p.taxYear === taxYear && p.quarter === q.quarter)
        .reduce((sum, p) => sum + p.amountCents, 0);
      if (suggested - paid <= 0) continue;
      const days = Math.round(
        (Date.parse(`${q.due}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY_MS
      );
      findings.push({
        agent,
        sourceKey: `fin:tax:${taxYear}-Q${q.quarter}`,
        title: `Q${q.quarter} estimated tax due ${shortDay(q.due)}`,
        detail: `Suggested about ${formatCents(suggested - paid, { whole: true })} more for income from ${q.covers} (at a ${Math.round(TAX_RATE * 100)}% income-tax set-aside). Pay through IRS Direct Pay, then record it.`,
        severity: days <= 7 ? 'urgent' : 'attention',
        href: '/kouture/taxes'
      });
    }
    const month = startOfMonth(today);
    const inMonth = (iso: string) => dayOf(iso) >= month;
    const revenue = s.payments
      .filter((p) => inMonth(p.receivedAt))
      .reduce((sum, p) => sum + (p.kind === 'refund' ? -p.amountCents : p.amountCents), 0);
    const spent = s.expenses
      .filter((e) => e.spentOn >= month && e.spentOn <= today)
      .reduce((sum, e) => sum + e.amountCents, 0);
    if (revenue > 0 && spent > revenue * 0.6 && Number(today.slice(8)) >= 10) {
      findings.push({
        agent,
        sourceKey: `fin:margin:${month}`,
        title: 'Spending is high this month',
        detail: `${formatCents(spent, { whole: true })} out against ${formatCents(revenue, { whole: true })} in, so far. Worth a look at what drove it.`,
        severity: 'attention',
        href: '/kouture/money'
      });
    }
    if (spent === 0 && Number(today.slice(8)) >= 10) {
      findings.push({
        agent,
        sourceKey: `fin:no-expenses:${month}`,
        title: 'No expenses logged this month',
        detail: 'Rent, supplies and subscriptions lower your taxes, but only if they’re recorded.',
        severity: 'info',
        href: '/kouture/money'
      });
    }
    briefings[agent] =
      `This month so far: ${formatCents(revenue, { whole: true })} in, ${formatCents(spent, { whole: true })} out, ${formatCents(revenue - spent, { whole: true })} profit. For the year, set aside about ${formatCents(tax.setAsideCents, { whole: true })} for taxes.`;
  }

  // ── Marketing ───────────────────────────────────────────────────────────
  {
    const agent: AgentKey = 'marketing_director';
    const horizon = addDays(today, 7);
    const upcoming = s.marketing.filter(
      (m) =>
        m.scheduledOn &&
        m.scheduledOn >= today &&
        m.scheduledOn <= horizon &&
        m.status !== 'published'
    );
    if (upcoming.length === 0) {
      findings.push({
        agent,
        sourceKey: `mkt:empty:${week}`,
        title: 'Nothing planned for the next 7 days',
        detail:
          'Even one post or story keeps you top of mind. Try a before-and-after of a recent set.',
        severity: 'attention',
        href: '/kouture/marketing'
      });
    }
    const late = s.marketing.filter(
      (m) => m.scheduledOn && m.scheduledOn < today && m.status !== 'published'
    );
    if (late.length > 0) {
      findings.push({
        agent,
        sourceKey: 'mkt:late',
        title: `${plural(late.length, 'post')} past their date`,
        detail: `${listNames(late.map((m) => m.title))}. Post them, move them, or mark them published.`,
        severity: 'attention',
        href: '/kouture/social'
      });
    }
    for (const m of s.marketing) {
      if (m.status !== 'ready' || !SOCIAL.has(m.channel) || !m.scheduledOn) continue;
      if (m.scheduledOn < today || m.scheduledOn > addDays(today, 2)) continue;
      drafts.push({
        agent,
        sourceKey: `mkt:publish:${m.id}`,
        actionType: 'publish_content',
        title: `Publish: ${m.title}`,
        summary: `Ready for ${m.channel[0].toUpperCase()}${m.channel.slice(1)} on ${shortDay(m.scheduledOn)}.`,
        payload: {
          itemId: m.id,
          channel: m.channel,
          scheduledOn: m.scheduledOn,
          caption: m.caption
        },
        risk: 'low'
      });
    }
    briefings[agent] =
      upcoming.length === 0
        ? 'Nothing is planned for the coming week yet.'
        : `Coming up: ${upcoming
            .slice(0, 3)
            .map((m) => `${m.title} (${shortDay(m.scheduledOn!)})`)
            .join('; ')}.`;
  }

  // ── Business analyst ────────────────────────────────────────────────────
  {
    const agent: AgentKey = 'business_analyst';
    const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();
    const recent = s.appointments.filter((a) => a.startsAt >= since && a.startsAt <= nowIso);
    const completed = recent.filter((a) => a.status === 'completed');
    const noShows = recent.filter((a) => a.status === 'no_show').length;
    const settled = completed.length + noShows;
    if (settled >= 10 && noShows / settled > 0.1) {
      findings.push({
        agent,
        sourceKey: 'ana:noshow',
        title: `No-shows are at ${Math.round((noShows / settled) * 100)}%`,
        detail:
          'Above 10% is costly. A reminder text the day before, or a firmer deposit policy, usually helps.',
        severity: 'attention',
        href: '/kouture/policies'
      });
    }
    const rebook = rebookRate(histories, now);
    if (completed.length >= 10 && rebook < 0.35) {
      findings.push({
        agent,
        sourceKey: 'ana:rebook',
        title: `Only ${Math.round(rebook * 100)}% of recent clients rebooked`,
        detail: 'Offering to book the next fill before they leave the chair is the easiest win.',
        severity: 'info',
        href: '/kouture/analytics'
      });
    }
    const top = topServices(recent, 1)[0];
    const busiest = bookingsByWeekday(recent, tz).toSorted((a, b) => b.count - a.count)[0];
    const avg = completed.length
      ? completed.reduce((sum, a) => sum + a.priceCents, 0) / completed.length
      : 0;
    briefings[agent] =
      completed.length === 0
        ? 'Not enough finished visits in the last 30 days to spot patterns yet.'
        : `Last 30 days: ${plural(completed.length, 'visit')}, ${formatCents(avg, { whole: true })} average ticket, ${Math.round(rebook * 100)}% rebooked.${top ? ` Top earner: ${top.name}.` : ''}${busiest?.count ? ` Busiest day: ${busiest.day}.` : ''}`;
  }

  // ── CEO ─────────────────────────────────────────────────────────────────
  {
    const ranked = findings.toSorted(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        TEAM_ORDER.indexOf(a.agent) - TEAM_ORDER.indexOf(b.agent)
    );
    // One item per team member first, so a single busy area doesn't crowd the rest out.
    const important = ranked.filter((f) => f.severity !== 'info');
    const firstPerAgent = important.filter(
      (f, i) => important.findIndex((g) => g.agent === f.agent) === i
    );
    const top = [...firstPerAgent, ...important.filter((f) => !firstPerAgent.includes(f))].slice(
      0,
      3
    );
    const waiting = s.pendingApprovals + drafts.length;
    const lines = top.map((f, i) => `${i + 1}. ${f.title} (${AGENTS[f.agent].name})`);
    briefings.ceo = [
      top.length === 0 ? 'Nothing urgent today. The team has it handled.' : 'Today’s priorities:',
      ...lines,
      waiting > 0 ? `Up to ${plural(waiting, 'request')} may be waiting in Approvals.` : '',
      briefings.operations_manager
    ]
      .filter(Boolean)
      .join('\n');
  }

  return { findings, drafts, briefings };
}

/** Rule-based answers for the chat while the AI brain is off. */
export function quickAnswer(
  agent: AgentKey,
  ask: 'needs' | 'update' | 'done',
  context: {
    open: { title: string; detail: string | null }[];
    done: { title: string }[];
    briefing: string | null;
  }
): string {
  if (ask === 'update')
    return context.briefing ?? 'I haven’t run my checks yet today. Tap “Run the team”.';
  if (ask === 'done') {
    return context.done.length
      ? `Recently cleared: ${context.done
          .slice(0, 5)
          .map((t) => t.title)
          .join('; ')}.`
      : 'Nothing cleared yet. I close items on my own once they’re handled.';
  }
  if (context.open.length === 0) return 'Nothing needs you from me right now.';
  return context.open
    .slice(0, 5)
    .map((t, i) => `${i + 1}. ${t.title}${t.detail ? `: ${t.detail}` : ''}`)
    .join('\n');
}
