import { budgetSummary, routineStatus, savingsProgress } from '@/features/life/lib/modules';
import { addDays, dayKey, formatTime, startOfWeek } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import type { AgentSeverity } from '@/server/data/types';
import type { RowOf } from '@/server/entities/definitions';

// Sophie, the personal assistant: plain checks over My Life data, no AI
// service. She reads journal dates only, never what the journal says.

export const ASSISTANT = {
  name: 'Sophie',
  title: 'Personal Assistant',
  mission:
    'Keeps your life side running: what’s due, what’s slipping, and what to look forward to.',
  watches: ['Tasks', 'Calendar', 'Habits', 'Budget & savings', 'Self-care', 'Travel'],
  quickAsks: [
    { id: 'needs', label: 'What needs me?' },
    { id: 'update', label: 'Give me your update' },
    { id: 'done', label: 'What did you finish?' }
  ] as const
};

export type LifeSnapshot = {
  today: string;
  timeZone: string;
  tasks: RowOf<'life.tasks'>[];
  events: RowOf<'life.events'>[];
  habits: { id: string; name: string; targetPerWeek: number; loggedDays: string[] }[];
  categories: RowOf<'life.budget_categories'>[];
  transactions: RowOf<'life.transactions'>[];
  savingsGoals: RowOf<'life.savings_goals'>[];
  contributions: RowOf<'life.savings_contributions'>[];
  routines: RowOf<'life.selfcare_routines'>[];
  trips: RowOf<'life.trips'>[];
  tripItems: RowOf<'life.trip_items'>[];
  journalDays: string[];
};

export type LifeFinding = {
  sourceKey: string;
  title: string;
  detail: string | null;
  severity: AgentSeverity;
  href: string | null;
};

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function listNames(names: string[], max = 3) {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

const DAY_MS = 86_400_000;

function daysUntil(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
}

export function runAssistant(s: LifeSnapshot): { findings: LifeFinding[]; briefing: string } {
  const { today } = s;
  const week = startOfWeek(today);
  const findings: LifeFinding[] = [];

  // Tasks
  const open = s.tasks.filter((t) => t.status === 'open');
  const overdue = open.filter((t) => t.dueOn && t.dueOn < today);
  const dueToday = open.filter((t) => t.dueOn === today);
  if (overdue.length > 0) {
    findings.push({
      sourceKey: 'life:tasks:overdue',
      title: `${plural(overdue.length, 'task')} overdue`,
      detail: listNames(overdue.map((t) => t.title)),
      severity: overdue.some((t) => t.priority === 'high') ? 'urgent' : 'attention',
      href: '/life/tasks'
    });
  }

  // Habits: behind pace for the week (only once the week is under way).
  const weekday = daysUntil(week, today) + 1; // Mon = 1
  const behind = s.habits.filter((h) => {
    const done = h.loggedDays.filter((d) => d >= week && d <= today).length;
    const left = 7 - weekday + 1;
    return weekday >= 3 && done + left < h.targetPerWeek;
  });
  if (behind.length > 0) {
    findings.push({
      sourceKey: `life:habits:${week}`,
      title: `${plural(behind.length, 'habit')} can’t hit this week’s goal`,
      detail: `${listNames(behind.map((h) => h.name))}. A fresh week starts Monday; no guilt.`,
      severity: 'info',
      href: '/life/habits'
    });
  }

  // Budget: categories over their monthly limit.
  const month = `${today.slice(0, 7)}-01`;
  const budget = budgetSummary(
    s.categories,
    s.transactions.filter((t) => t.occurredOn >= month && t.occurredOn <= today)
  );
  const over = budget.lines.filter((l) => l.usage !== null && l.usage > 1);
  const near = budget.lines.filter((l) => l.usage !== null && l.usage > 0.85 && l.usage <= 1);
  if (over.length > 0) {
    findings.push({
      sourceKey: `life:budget:over:${month}`,
      title: `Over budget on ${listNames(over.map((l) => l.category.name))}`,
      detail: over
        .map(
          (l) =>
            `${l.category.name}: ${formatCents(l.spentCents, { whole: true })} of ${formatCents(l.category.monthlyLimitCents ?? 0, { whole: true })}`
        )
        .join('; '),
      severity: 'attention',
      href: '/life/budget'
    });
  } else if (near.length > 0) {
    findings.push({
      sourceKey: `life:budget:near:${month}`,
      title: `Close to the limit on ${listNames(near.map((l) => l.category.name))}`,
      detail: null,
      severity: 'info',
      href: '/life/budget'
    });
  }

  // Savings goals past their date and not reached.
  for (const goal of s.savingsGoals.filter((g) => g.status === 'active')) {
    const p = savingsProgress(goal, s.contributions, today);
    if (p.overdue) {
      findings.push({
        sourceKey: `life:savings:${goal.id}`,
        title: `“${goal.name}” is past its target date`,
        detail: `${formatCents(p.remainingCents, { whole: true })} to go. Pick a new date or a new monthly amount.`,
        severity: 'attention',
        href: '/life/savings'
      });
    }
  }

  // Self-care due or overdue.
  const due = s.routines
    .filter((r) => !r.archived)
    .map((r) => ({ r, st: routineStatus(r, today) }))
    .filter(({ st }) => st.status === 'overdue' || st.status === 'due');
  if (due.length > 0) {
    findings.push({
      sourceKey: 'life:selfcare',
      title: `Time for ${listNames(due.map(({ r }) => r.name))}`,
      detail: 'You take care of everyone else’s hands all week. Book yours.',
      severity: 'info',
      href: '/life/self-care'
    });
  }

  // Trips within two weeks with unfinished prep.
  for (const trip of s.trips.filter((t) => t.status !== 'done')) {
    const days = daysUntil(today, trip.startsOn);
    if (days < 0 || days > 14) continue;
    const todo = s.tripItems.filter((i) => i.tripId === trip.id && !i.done);
    findings.push({
      sourceKey: `life:trip:${trip.id}`,
      title: `${trip.name} in ${plural(days, 'day')}`,
      detail: todo.length
        ? `${plural(todo.length, 'thing')} left to sort: ${listNames(todo.map((i) => i.title))}.`
        : 'Everything on your list is done. Enjoy!',
      severity: todo.length && days <= 3 ? 'attention' : 'info',
      href: '/life/travel'
    });
  }

  // Briefing
  const events = s.events
    .filter((e) => dayKey(new Date(e.startsAt), s.timeZone) === today)
    .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
  const wroteYesterday = s.journalDays.includes(addDays(today, -1));
  const parts = [
    events.length
      ? `Today: ${events.map((e) => `${e.title} at ${formatTime(e.startsAt, s.timeZone)}`).join(', ')}.`
      : 'Nothing on your personal calendar today.',
    dueToday.length ? `Due today: ${listNames(dueToday.map((t) => t.title))}.` : '',
    overdue.length ? `${plural(overdue.length, 'task')} overdue.` : '',
    over.length ? `Watch spending on ${listNames(over.map((l) => l.category.name))}.` : '',
    due.length ? `Self-care due: ${listNames(due.map(({ r }) => r.name))}.` : '',
    wroteYesterday ? '' : 'A few lines in your journal tonight might feel good.'
  ].filter(Boolean);
  return { findings, briefing: parts.join('\n') };
}
