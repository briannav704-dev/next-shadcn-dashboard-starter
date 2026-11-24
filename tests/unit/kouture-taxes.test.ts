import { describe, expect, it } from 'vitest';

import {
  quarterlyDeadlines,
  selfEmploymentTax,
  taxYearSummary
} from '@/features/kouture/lib/taxes';

describe('self-employment tax', () => {
  it('is 15.3% of 92.35% of profit, and nothing under the $400 floor', () => {
    expect(selfEmploymentTax(5_000_000)).toBe(Math.round(5_000_000 * 0.9235 * 0.153));
    expect(selfEmploymentTax(40_000)).toBe(0);
    expect(selfEmploymentTax(-100_000)).toBe(0);
  });
});

describe('quarterly deadlines', () => {
  it('rolls weekend due dates to Monday and puts Q4 in January', () => {
    // 2026: Apr 15 Wed, Jun 15 Mon, Sep 15 Tue, Jan 15 2027 Fri.
    expect(quarterlyDeadlines(2026).map((q) => q.due)).toEqual([
      '2026-04-15',
      '2026-06-15',
      '2026-09-15',
      '2027-01-15'
    ]);
    // 2028: Apr 15 is a Saturday → Monday Apr 17.
    expect(quarterlyDeadlines(2028)[0].due).toBe('2028-04-17');
  });
});

describe('tax year summary', () => {
  const pay = (
    kind: 'deposit' | 'balance' | 'tip' | 'refund',
    method: 'stripe' | 'cash',
    amountCents: number,
    receivedAt: string
  ) => ({
    id: receivedAt + kind,
    appointmentId: null,
    kind,
    method,
    amountCents,
    receivedAt
  });
  const summary = taxYearSummary({
    year: 2026,
    timeZone: 'America/New_York',
    incomeTaxRate: 0.15,
    payments: [
      pay('deposit', 'stripe', 2_500_000, '2026-02-10T18:00:00Z'),
      pay('balance', 'cash', 5_000_000, '2026-07-10T18:00:00Z'),
      pay('tip', 'cash', 500_000, '2026-07-10T18:00:00Z'),
      pay('refund', 'stripe', 100_000, '2026-07-11T18:00:00Z'),
      // New Year's Eve in New York, already 2027 in UTC: still 2026 income.
      pay('balance', 'cash', 10_000, '2027-01-01T03:00:00Z'),
      pay('balance', 'cash', 99_999, '2027-01-02T18:00:00Z')
    ],
    expenses: [
      { id: 'e1', category: 'rent', vendor: null, amountCents: 1_200_000, spentOn: '2026-03-01' },
      { id: 'e2', category: 'supplies', vendor: null, amountCents: 300_000, spentOn: '2026-08-01' },
      { id: 'e3', category: 'education', vendor: null, amountCents: 50_000, spentOn: '2026-10-01' },
      { id: 'e4', category: 'other', vendor: null, amountCents: 20_000, spentOn: '2026-11-01' },
      { id: 'e5', category: 'rent', vendor: null, amountCents: 999_999, spentOn: '2025-12-31' }
    ]
  });

  it('totals receipts, refunds and expenses for the year only', () => {
    expect(summary).toMatchObject({
      grossReceiptsCents: 8_010_000,
      tipsCents: 500_000,
      refundsCents: 100_000,
      cardCents: 2_400_000,
      cashCents: 5_510_000,
      expensesCents: 1_570_000,
      netProfitCents: 6_340_000
    });
  });

  it('groups expenses by Schedule C line, merging lines that share one', () => {
    expect(summary.lines.map((l) => [l.line, l.cents])).toEqual([
      ['20b', 1_200_000],
      ['22', 300_000],
      ['27a', 50_000],
      ['27a', 20_000]
    ]);
  });

  it('sets aside SE tax plus income tax on profit after half the SE tax', () => {
    const se = Math.round(6_340_000 * 0.9235 * 0.153);
    expect(summary.selfEmploymentTaxCents).toBe(se);
    expect(summary.incomeTaxSetAsideCents).toBe(
      Math.round((6_340_000 - Math.round(se / 2)) * 0.15)
    );
    expect(summary.byQuarter).toEqual([
      { quarter: 1, netProfitCents: 2_500_000 - 1_200_000 },
      { quarter: 2, netProfitCents: 0 },
      { quarter: 3, netProfitCents: 5_000_000 + 500_000 - 100_000 - 300_000 },
      { quarter: 4, netProfitCents: 10_000 - 50_000 - 20_000 }
    ]);
  });
});
