import { addDays, dayKey } from '@/lib/dates';
import type { Expense, Payment } from '@/server/data/types';

// Tax planning maths for a self-employed nail tech (US sole proprietor,
// Schedule C). These are planning estimates, not tax advice: the page says so,
// and the owner's preparer has the final word.

/** Net earnings from self-employment are 92.35% of profit; SE tax is 15.3% of that. */
export const SE_EARNINGS_FACTOR = 0.9235;
export const SE_TAX_RATE = 0.153;
/** Below this, no self-employment tax is due. */
export const SE_TAX_MINIMUM_EARNINGS_CENTS = 40_000;

export type ScheduleCLine = { line: string; label: string };

/** The Schedule C line each expense category usually lands on. */
export const SCHEDULE_C: Record<Expense['category'], ScheduleCLine> = {
  supplies: { line: '22', label: 'Supplies' },
  rent: { line: '20b', label: 'Rent — other business property' },
  marketing: { line: '8', label: 'Advertising' },
  software: { line: '18', label: 'Office expense' },
  education: { line: '27a', label: 'Other expenses (education)' },
  equipment: { line: '13', label: 'Depreciation / section 179 (equipment)' },
  fees: { line: '10', label: 'Commissions and fees' },
  other: { line: '27a', label: 'Other expenses' }
};

export function selfEmploymentTax(netProfitCents: number): number {
  const earnings = Math.max(0, netProfitCents) * SE_EARNINGS_FACTOR;
  if (earnings < SE_TAX_MINIMUM_EARNINGS_CENTS) return 0;
  return Math.round(earnings * SE_TAX_RATE);
}

/** Moves a deadline that falls on a weekend to the following Monday. */
function nextWeekday(key: string): string {
  const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
  return weekday === 6 ? addDays(key, 2) : weekday === 0 ? addDays(key, 1) : key;
}

export type QuarterDeadline = {
  quarter: 1 | 2 | 3 | 4;
  /** Months of income the payment covers. */
  covers: string;
  periodStart: string;
  periodEnd: string;
  due: string;
};

/** IRS estimated-tax quarters for a tax year (weekends rolled; federal holidays not). */
export function quarterlyDeadlines(year: number): QuarterDeadline[] {
  return [
    {
      quarter: 1,
      covers: 'Jan – Mar',
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-03-31`,
      due: `${year}-04-15`
    },
    {
      quarter: 2,
      covers: 'Apr – May',
      periodStart: `${year}-04-01`,
      periodEnd: `${year}-05-31`,
      due: `${year}-06-15`
    },
    {
      quarter: 3,
      covers: 'Jun – Aug',
      periodStart: `${year}-06-01`,
      periodEnd: `${year}-08-31`,
      due: `${year}-09-15`
    },
    {
      quarter: 4,
      covers: 'Sep – Dec',
      periodStart: `${year}-09-01`,
      periodEnd: `${year}-12-31`,
      due: `${year + 1}-01-15`
    }
  ].map((q) => ({ ...q, quarter: q.quarter as 1 | 2 | 3 | 4, due: nextWeekday(q.due) }));
}

export type TaxYearSummary = {
  grossReceiptsCents: number;
  tipsCents: number;
  refundsCents: number;
  cardCents: number;
  cashCents: number;
  expensesCents: number;
  netProfitCents: number;
  selfEmploymentTaxCents: number;
  /** Half of SE tax is an adjustment to income on the personal return. */
  seDeductionCents: number;
  incomeTaxSetAsideCents: number;
  setAsideCents: number;
  lines: (ScheduleCLine & { cents: number })[];
  byQuarter: { quarter: number; netProfitCents: number }[];
};

/**
 * Year totals in the owner's timezone. Tips count as income for a business
 * owner. Card vs cash totals help reconcile the 1099-K Stripe may send.
 */
export function taxYearSummary(input: {
  year: number;
  payments: Payment[];
  expenses: Expense[];
  timeZone: string;
  /** Share of profit (after half SE tax) to set aside for income tax, 0–1. */
  incomeTaxRate: number;
}): TaxYearSummary {
  const { year, payments, expenses, timeZone, incomeTaxRate } = input;
  const quarters = quarterlyDeadlines(year);
  const quarterOf = (day: string) =>
    quarters.find((q) => day >= q.periodStart && day <= q.periodEnd)?.quarter;
  const perQuarter = new Map<number, number>([1, 2, 3, 4].map((q) => [q, 0]));
  let gross = 0;
  let tips = 0;
  let refunds = 0;
  let card = 0;
  let cash = 0;
  for (const p of payments) {
    const day = dayKey(new Date(p.receivedAt), timeZone);
    if (!day.startsWith(`${year}-`)) continue;
    const signed = p.kind === 'refund' ? -p.amountCents : p.amountCents;
    if (p.kind === 'refund') refunds += p.amountCents;
    else gross += p.amountCents;
    if (p.kind === 'tip') tips += p.amountCents;
    if (p.method === 'stripe') card += signed;
    else cash += signed;
    const q = quarterOf(day);
    if (q) perQuarter.set(q, (perQuarter.get(q) ?? 0) + signed);
  }
  const byLine = new Map<string, ScheduleCLine & { cents: number }>();
  let spent = 0;
  for (const e of expenses) {
    if (!e.spentOn.startsWith(`${year}-`)) continue;
    spent += e.amountCents;
    const line = SCHEDULE_C[e.category];
    const key = `${line.line}|${line.label}`;
    const row = byLine.get(key) ?? { ...line, cents: 0 };
    row.cents += e.amountCents;
    byLine.set(key, row);
    const q = quarterOf(e.spentOn);
    if (q) perQuarter.set(q, (perQuarter.get(q) ?? 0) - e.amountCents);
  }
  const net = gross - refunds - spent;
  const se = selfEmploymentTax(net);
  const seDeduction = Math.round(se / 2);
  const incomeTax = Math.round(Math.max(0, net - seDeduction) * incomeTaxRate);
  const lineOrder = (l: string) =>
    Number.parseFloat(l) + (l.endsWith('b') ? 0.2 : l.endsWith('a') ? 0.1 : 0);
  return {
    grossReceiptsCents: gross,
    tipsCents: tips,
    refundsCents: refunds,
    cardCents: card,
    cashCents: cash,
    expensesCents: spent,
    netProfitCents: net,
    selfEmploymentTaxCents: se,
    seDeductionCents: seDeduction,
    incomeTaxSetAsideCents: incomeTax,
    setAsideCents: se + incomeTax,
    lines: [...byLine.values()].toSorted((a, b) => lineOrder(a.line) - lineOrder(b.line)),
    byQuarter: [...perQuarter.entries()].map(([quarter, netProfitCents]) => ({
      quarter,
      netProfitCents
    }))
  };
}
