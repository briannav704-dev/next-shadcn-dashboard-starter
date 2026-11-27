import { describe, expect, it } from 'vitest';

import { type LifeSnapshot, runAssistant } from '@/features/assistant/rules';

const today = '2026-11-26'; // Thursday

function snapshot(over: Partial<LifeSnapshot> = {}): LifeSnapshot {
  return {
    today,
    timeZone: 'America/New_York',
    tasks: [],
    events: [],
    habits: [],
    categories: [],
    transactions: [],
    savingsGoals: [],
    contributions: [],
    routines: [],
    trips: [],
    tripItems: [],
    journalDays: [today],
    ...over
  };
}

const task = (
  title: string,
  dueOn: string | null,
  priority: 'low' | 'normal' | 'high' = 'normal'
) => ({
  id: title,
  title,
  notes: null,
  dueOn,
  priority,
  status: 'open' as const,
  completedAt: null
});

describe('personal assistant', () => {
  it('flags overdue tasks, urgently when one is high priority', () => {
    const r = runAssistant(
      snapshot({ tasks: [task('Renew license', '2026-11-20', 'high'), task('Call mom', today)] })
    );
    expect(r.findings).toEqual([
      expect.objectContaining({
        sourceKey: 'life:tasks:overdue',
        title: '1 task overdue',
        severity: 'urgent'
      })
    ]);
    expect(r.briefing).toContain('Due today: Call mom.');
  });

  it('only calls a habit behind once the week can no longer be saved', () => {
    const habit = (loggedDays: string[]) => ({
      id: 'h',
      name: 'Water',
      targetPerWeek: 7,
      loggedDays
    });
    // Thursday, 2 of 7 so far: 4 days left can reach at most 6.
    expect(
      runAssistant(snapshot({ habits: [habit(['2026-11-23', '2026-11-24'])] })).findings[0]
        ?.sourceKey
    ).toBe('life:habits:2026-11-23');
    expect(
      runAssistant(snapshot({ habits: [habit(['2026-11-23', '2026-11-24', '2026-11-25'])] }))
        .findings
    ).toEqual([]);
  });

  it('notices overspending and self-care that is due', () => {
    const r = runAssistant(
      snapshot({
        categories: [
          {
            id: 'c',
            name: 'Dining out',
            kind: 'expense',
            monthlyLimitCents: 10000,
            sortOrder: 0,
            archived: false
          }
        ],
        transactions: [
          {
            id: 't',
            occurredOn: '2026-11-10',
            kind: 'expense',
            amountCents: 12500,
            categoryId: 'c',
            description: 'x'
          }
        ],
        routines: [
          {
            id: 'r',
            name: 'Lash fill',
            category: 'lashes',
            everyDays: 21,
            lastDoneOn: '2026-10-30',
            provider: null,
            notes: null,
            archived: false
          }
        ]
      })
    );
    expect(r.findings.map((f) => f.sourceKey)).toEqual([
      'life:budget:over:2026-11-01',
      'life:selfcare'
    ]);
    expect(r.findings[0].detail).toBe('Dining out: $125 of $100');
  });

  it('counts down to a trip with prep left, and suggests journaling only when she skipped', () => {
    const r = runAssistant(
      snapshot({
        trips: [
          {
            id: 'm',
            name: 'Miami',
            destination: 'Miami',
            startsOn: '2026-11-28',
            endsOn: '2026-12-01',
            budgetCents: null,
            status: 'booked',
            notes: null
          }
        ],
        tripItems: [
          {
            id: 'i',
            tripId: 'm',
            kind: 'packing',
            title: 'Swimsuit',
            onDay: null,
            costCents: null,
            done: false
          }
        ],
        journalDays: []
      })
    );
    expect(r.findings[0]).toMatchObject({ title: 'Miami in 2 days', severity: 'attention' });
    expect(r.briefing).toContain('journal');
  });
});
