import { SectionCard } from '@/components/lux/section-card';
import { EmptyNote } from '@/components/lux/empty-note';
import { formatCents } from '@/lib/money';
import type { Expense } from '@/server/data/types';

const EXPENSE_LABEL: Record<Expense['category'], string> = {
  supplies: 'Supplies',
  rent: 'Suite rent',
  marketing: 'Marketing',
  software: 'Software',
  education: 'Education',
  equipment: 'Equipment',
  fees: 'Processing fees',
  other: 'Other'
};

/** Month-to-date: where money came from (Stripe vs cash vs tips) and where it went. */
export function MoneyMix({
  mix,
  expenses,
  expenseTotal
}: {
  mix: { stripeCents: number; cashCents: number; tipCents: number };
  expenses: { category: Expense['category']; cents: number }[];
  expenseTotal: number;
}) {
  const income = [
    { key: 'stripe', label: 'Stripe deposits', cents: mix.stripeCents, color: 'var(--chart-1)' },
    { key: 'cash', label: 'Cash balances', cents: mix.cashCents, color: 'var(--chart-2)' },
    { key: 'tips', label: 'Tips', cents: mix.tipCents, color: 'var(--chart-3)' }
  ];
  const incomeTotal = income.reduce((s, i) => s + i.cents, 0);
  const maxExpense = Math.max(1, ...expenses.map((e) => e.cents));

  return (
    <SectionCard title='Money mix' eyebrow='This month'>
      {incomeTotal === 0 ? (
        <EmptyNote>No payments recorded this month yet.</EmptyNote>
      ) : (
        <>
          <div
            className='flex h-3 gap-0.5 overflow-hidden rounded-full'
            role='img'
            aria-label='Income split'
          >
            {income
              .filter((i) => i.cents > 0)
              .map((i) => (
                <span
                  key={i.key}
                  style={{ width: `${(i.cents / incomeTotal) * 100}%`, background: i.color }}
                />
              ))}
          </div>
          <ul className='mt-3 space-y-1.5'>
            {income.map((i) => (
              <li key={i.key} className='flex items-center gap-2 text-sm'>
                <span
                  className='size-2.5 rounded-[3px]'
                  style={{ background: i.color }}
                  aria-hidden
                />
                <span className='text-muted-foreground flex-1'>{i.label}</span>
                <span className='tabular-nums'>{formatCents(i.cents, { whole: true })}</span>
                <span className='text-muted-foreground w-10 text-right text-xs tabular-nums'>
                  {Math.round((i.cents / incomeTotal) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className='mt-6 flex items-baseline justify-between'>
        <p className='text-gold-ink text-[0.65rem] font-medium tracking-[0.2em] uppercase'>
          Expenses
        </p>
        <p className='text-sm tabular-nums'>{formatCents(expenseTotal, { whole: true })}</p>
      </div>
      {expenses.length === 0 ? (
        <EmptyNote className='mt-2'>No expenses logged this month.</EmptyNote>
      ) : (
        <ul className='mt-2 space-y-2'>
          {expenses.map((e) => (
            <li key={e.category}>
              <div className='flex justify-between text-xs'>
                <span className='text-muted-foreground'>{EXPENSE_LABEL[e.category]}</span>
                <span className='tabular-nums'>{formatCents(e.cents, { whole: true })}</span>
              </div>
              <div className='bg-muted mt-1 h-1.5 overflow-hidden rounded-full'>
                <div
                  className='bg-chart-1 h-full rounded-full'
                  style={{ width: `${(e.cents / maxExpense) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
