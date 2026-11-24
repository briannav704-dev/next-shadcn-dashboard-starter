import { describe, expect, it } from 'vitest';

import { buildHabitViews, currentStreak, goalProgress } from '@/features/life/lib/summary';

describe('habits', () => {
  it('counts a streak through yesterday when today is still open', () => {
    expect(currentStreak(['2026-11-21', '2026-11-22', '2026-11-23'], '2026-11-24')).toBe(3);
    expect(currentStreak(['2026-11-22', '2026-11-23', '2026-11-24'], '2026-11-24')).toBe(3);
    expect(currentStreak(['2026-11-20', '2026-11-22'], '2026-11-24')).toBe(0);
  });

  it('builds week totals from Monday and a 7-day strip', () => {
    const [view] = buildHabitViews(
      [
        {
          id: 'h',
          name: 'Water',
          targetPerWeek: 7,
          loggedDays: ['2026-11-22', '2026-11-23', '2026-11-24']
        }
      ],
      '2026-11-24'
    );
    expect(view.doneToday).toBe(true);
    expect(view.thisWeek).toBe(2); // Mon 23 + Tue 24; Sun 22 is last week
    expect(view.last7).toHaveLength(7);
    expect(view.last7.at(-1)).toEqual({ day: '2026-11-24', done: true });
  });

  it('clamps goal progress', () => {
    const base = {
      id: 'g',
      title: 'x',
      area: 'money' as const,
      unit: '$',
      targetDate: null,
      status: 'active' as const
    };
    expect(goalProgress({ ...base, targetValue: 100, currentValue: 25 })).toBe(0.25);
    expect(goalProgress({ ...base, targetValue: 100, currentValue: 140 })).toBe(1);
  });
});

describe('bestStreak', () => {
  it('finds the longest consecutive run', async () => {
    const { bestStreak } = await import('@/features/life/lib/summary');
    expect(bestStreak(['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05', '2026-11-06'])).toBe(
      3
    );
    expect(bestStreak([])).toBe(0);
  });
});
