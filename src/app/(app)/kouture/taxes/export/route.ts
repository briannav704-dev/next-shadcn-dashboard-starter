import { EXPENSE_CATEGORY_LABEL } from '@/features/kouture/forms';
import { SCHEDULE_C } from '@/features/kouture/lib/taxes';
import { DEFAULT_INCOME_TAX_RATE, loadTaxYear } from '@/features/kouture/server/load-taxes';
import { todayKey } from '@/lib/dates';
import { getOwnerSession } from '@/server/session';

// Tax-year package for the owner's preparer: Schedule C summary, quarterly
// payments and the expense ledger. Owner-only, never cached.
export const dynamic = 'force-dynamic';

const dollars = (cents: number) => (cents / 100).toFixed(2);

/** Quotes a cell and neutralises spreadsheet formulas in free text. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const session = await getOwnerSession();
  if (!session) return new Response('Sign in required', { status: 401 });

  const current = Number(todayKey(session.profile.timezone).slice(0, 4));
  const requested = Number(new URL(request.url).searchParams.get('year'));
  const year =
    Number.isInteger(requested) && requested >= 2000 && requested <= current ? requested : current;
  const {
    summary: s,
    expenses,
    taxPayments
  } = await loadTaxYear(session, year, DEFAULT_INCOME_TAX_RATE);

  const rows: string[][] = [
    ['Kouture Nail Bar', `Tax year ${year}`, 'Planning summary, not a tax return'],
    [],
    ['Schedule C line', 'Description', 'Amount'],
    ['1', 'Gross receipts (incl. tips)', dollars(s.grossReceiptsCents)],
    ['2', 'Returns and allowances (refunds)', dollars(s.refundsCents)],
    ...s.lines.map((l) => [l.line, l.label, dollars(l.cents)]),
    ['28', 'Total expenses', dollars(s.expensesCents)],
    ['31', 'Net profit', dollars(s.netProfitCents)],
    [],
    ['Card (Stripe) receipts', '', dollars(s.cardCents)],
    ['Cash and other receipts', '', dollars(s.cashCents)],
    ['Tips included above', '', dollars(s.tipsCents)],
    ['Estimated self-employment tax', '', dollars(s.selfEmploymentTaxCents)],
    [],
    ['Estimated tax payments', 'Quarter', 'Paid to', 'Paid on', 'Amount', 'Note'],
    ...taxPayments.map((p) => [
      '',
      `Q${p.quarter}`,
      p.jurisdiction === 'federal' ? 'IRS' : 'State',
      p.paidOn,
      dollars(p.amountCents),
      p.note ?? ''
    ]),
    [],
    ['Expense ledger', 'Date', 'Category', 'Schedule C line', 'Paid to', 'What for', 'Amount'],
    ...expenses.map((e) => [
      '',
      e.spentOn,
      EXPENSE_CATEGORY_LABEL[e.category],
      SCHEDULE_C[e.category].line,
      e.vendor ?? '',
      e.description ?? '',
      dollars(e.amountCents)
    ])
  ];
  const csv = rows.map((r) => r.map(cell).join(',')).join('\r\n');

  return new Response(`${csv}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="kouture-taxes-${year}.csv"`,
      'cache-control': 'private, no-store'
    }
  });
}
