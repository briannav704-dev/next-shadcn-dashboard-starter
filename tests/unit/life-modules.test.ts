import { describe, expect, it } from 'vitest';

import {
  budgetSummary,
  daysFrom,
  endOfMonth,
  fitnessSummary,
  isoWeekday,
  monthGrid,
  moodSummary,
  routineStatus,
  savingsProgress,
  shiftMonth,
  sortRoutines,
  tripSummary,
  wholeMonthsBetween
} from '@/features/life/lib/modules';

const today = '2026-11-24'; // Tuesday

describe('calendar helpers', () => {
  it('handles month ends and shifts', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01');
    expect(shiftMonth('2026-01-01', -1)).toBe('2025-12-01');
    expect(daysFrom('2026-11-24', '2026-12-01')).toBe(7);
    expect(wholeMonthsBetween('2026-11-24', '2027-02-24')).toBe(3);
    expect(wholeMonthsBetween('2026-11-24', '2027-02-23')).toBe(2);
    expect(isoWeekday('2026-11-23')).toBe(1);
    expect(isoWeekday('2026-11-29')).toBe(7);
  });

  it('builds Monday-first month grids', () => {
    const grid = monthGrid('2026-11-01');
    expect(grid[0][0]).toBe('2026-10-26');
    expect(grid.at(-1)!.at(-1)).toBe('2026-12-06');
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });
});

describe('budget', () => {
  const cats = [
    {
      id: 'g',
      name: 'Groceries',
      kind: 'expense' as const,
      monthlyLimitCents: 50000,
      sortOrder: 0,
      archived: false
    },
    {
      id: 'd',
      name: 'Dining',
      kind: 'expense' as const,
      monthlyLimitCents: null,
      sortOrder: 1,
      archived: false
    },
    {
      id: 'p',
      name: 'Pay',
      kind: 'income' as const,
      monthlyLimitCents: null,
      sortOrder: 2,
      archived: false
    }
  ];
  const tx = (
    id: string,
    kind: 'income' | 'expense',
    amountCents: number,
    categoryId: string | null
  ) => ({
    id,
    occurredOn: today,
    kind,
    amountCents,
    categoryId,
    description: id
  });

  it('totals income, spending and per-category usage', () => {
    const s = budgetSummary(cats, [
      tx('1', 'income', 300000, 'p'),
      tx('2', 'expense', 60000, 'g'),
      tx('3', 'expense', 2000, 'd'),
      tx('4', 'expense', 1500, null)
    ]);
    expect(s).toMatchObject({
      incomeCents: 300000,
      expenseCents: 63500,
      netCents: 236500,
      uncategorizedCents: 1500,
      plannedCents: 50000
    });
    expect(s.lines.map((l) => [l.category.id, l.spentCents, l.usage])).toEqual([
      ['g', 60000, 1.2],
      ['d', 2000, null]
    ]);
  });
});

describe('savings', () => {
  const goal = {
    id: 'g',
    name: 'Trip',
    targetCents: 100000,
    targetDate: '2027-02-24',
    status: 'active' as const
  };
  const c = (amountCents: number) => ({
    id: String(amountCents),
    goalId: 'g',
    amountCents,
    contributedOn: today,
    note: null
  });

  it('nets withdrawals and paces the remaining amount by month', () => {
    const p = savingsProgress(goal, [c(50000), c(-10000), { ...c(99999), goalId: 'other' }], today);
    expect(p.savedCents).toBe(40000);
    expect(p.progress).toBeCloseTo(0.4);
    expect(p.monthlyNeededCents).toBe(20000); // 60000 over 3 months
    expect(p.overdue).toBe(false);
  });
});

describe('self-care', () => {
  const routine = (lastDoneOn: string | null, everyDays = 14) => ({
    id: lastDoneOn ?? 'never',
    name: 'Fill',
    category: 'nails' as const,
    everyDays,
    lastDoneOn,
    provider: null,
    notes: null,
    archived: false
  });

  it('computes next due and status', () => {
    expect(routineStatus(routine('2026-11-01'), today)).toMatchObject({
      nextDue: '2026-11-15',
      status: 'overdue'
    });
    expect(routineStatus(routine('2026-11-10'), today).status).toBe('due');
    expect(routineStatus(routine('2026-11-12'), today)).toMatchObject({
      daysUntil: 2,
      status: 'soon'
    });
    expect(routineStatus(routine(null), today).status).toBe('never');
  });

  it('sorts the most urgent first and hides archived', () => {
    const list = sortRoutines(
      [
        routine('2026-11-20'),
        routine('2026-10-01'),
        { ...routine('2026-11-01'), archived: true },
        routine(null)
      ],
      today
    );
    expect(list.map((r) => r.status)).toEqual(['overdue', 'never', 'ok']);
  });
});

describe('fitness', () => {
  const log = (performedOn: string, durationMinutes: number, kind = 'pilates' as const) => ({
    id: performedOn + durationMinutes,
    performedOn,
    kind,
    title: 'x',
    durationMinutes,
    intensity: 'moderate' as const,
    notes: null
  });

  it('sums weeks and counts the active-week streak', () => {
    const s = fitnessSummary(
      [log('2026-11-23', 50), log('2026-11-24', 30), log('2026-11-18', 40), log('2026-11-02', 20)],
      today,
      4
    );
    expect(s.series.map((w) => w.minutes)).toEqual([20, 0, 40, 80]);
    expect(s).toMatchObject({ thisWeekMinutes: 80, thisWeekSessions: 2, streakWeeks: 2 });
  });
});

describe('journal and travel', () => {
  it('averages mood and counts the writing streak', () => {
    const e = (entryOn: string, mood: number | null) => ({
      id: entryOn,
      entryOn,
      mood,
      title: null,
      body: null,
      gratitude: null
    });
    const m = moodSummary([e('2026-11-23', 4), e('2026-11-22', 2), e('2026-11-20', null)], today);
    expect(m).toMatchObject({ average: 3, count: 2, streak: 2 });
  });

  it('counts down and tracks packing and spend', () => {
    const trip = {
      id: 't',
      name: 'Miami',
      destination: 'Miami',
      startsOn: '2026-12-12',
      endsOn: '2026-12-16',
      budgetCents: 200000,
      status: 'booked' as const,
      notes: null
    };
    const item = (kind: 'stay' | 'packing', costCents: number | null, done: boolean) => ({
      id: `${kind}${costCents}${done}`,
      tripId: 't',
      kind,
      title: 'x',
      onDay: null,
      costCents,
      done
    });
    const s = tripSummary(
      trip,
      [item('stay', 120000, true), item('packing', null, true), item('packing', null, false)],
      today
    );
    expect(s).toMatchObject({
      daysUntil: 18,
      nights: 4,
      committedCents: 120000,
      budgetUsage: 0.6,
      packed: 1,
      packingTotal: 2
    });
  });
});
