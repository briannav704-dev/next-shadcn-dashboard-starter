import type { Metadata } from 'next';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { SectionCard } from '@/components/lux/section-card';
import { StatCard } from '@/components/lux/stat-card';
import { StackedBars } from '@/features/kouture/components/stacked-bars';
import { monthLabel } from '@/features/kouture/lib/insights';
import { loadProfitReport } from '@/features/kouture/server/load-report';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Profit reports' };

const MONTHS = 6;

export default async function ReportsPage() {
  const session = await requireOwnerPage();
  const { lines } = await loadProfitReport(session, MONTHS);
  const totals = lines.reduce(
    (t, l) => ({
      income: t.income + l.serviceCents + l.tipCents - l.refundCents,
      expenses: t.expenses + l.expenseCents,
      profit: t.profit + l.profitCents,
      visits: t.visits + l.visits
    }),
    { income: 0, expenses: 0, profit: 0, visits: 0 }
  );
  const complete = lines.slice(0, -1);
  const best = complete.toSorted((a, b) => b.profitCents - a.profitCents)[0];

  return (
    <PageContainer
      eyebrow='Kouture · Money'
      pageTitle='Profit reports'
      pageDescription='What the salon earned, spent and kept, month by month. The current month is still in progress.'
      pageHeaderAction={
        <a
          href='/kouture/reports/export?months=12'
          download
          className='border-input hover:bg-blush/60 inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors'
        >
          <Icons.download className='size-4' aria-hidden />
          Download 12 months (CSV)
        </a>
      }
    >
      <div className='grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4'>
        <StatCard
          label={`Income · ${MONTHS} months`}
          icon='cash'
          value={formatCents(totals.income, { whole: true })}
        />
        <StatCard
          label='Expenses'
          icon='receipt'
          value={formatCents(totals.expenses, { whole: true })}
        />
        <StatCard
          label='Profit'
          icon='trendingUp'
          value={formatCents(totals.profit, { whole: true })}
          hint={
            totals.income
              ? `${Math.round((totals.profit / totals.income) * 100)}% margin`
              : undefined
          }
        />
        <StatCard
          label='Best month'
          icon='sparkles'
          value={best ? monthLabel(best.month, 'short') : '—'}
          hint={best ? `${formatCents(best.profitCents, { whole: true })} profit` : undefined}
        />
      </div>

      <SectionCard className='mt-5' title='Income and expenses' eyebrow='By month'>
        <StackedBars
          caption='Income and expenses by month'
          money
          series={[
            { key: 'income', label: 'Income (services + tips)' },
            { key: 'expenses', label: 'Expenses' }
          ]}
          data={lines.map((l) => ({
            label: monthLabel(l.month),
            income: l.serviceCents + l.tipCents - l.refundCents,
            expenses: l.expenseCents
          }))}
        />
      </SectionCard>

      <SectionCard className='mt-5' title='Profit & loss' eyebrow='Statement'>
        <div className='-mx-5 overflow-x-auto px-5'>
          <table className='w-full min-w-[34rem] text-sm'>
            <thead>
              <tr className='text-muted-foreground text-left text-xs'>
                <th scope='col' className='py-2 font-medium'>
                  Month
                </th>
                <th scope='col' className='py-2 text-right font-medium'>
                  Services
                </th>
                <th scope='col' className='py-2 text-right font-medium'>
                  Tips
                </th>
                <th scope='col' className='py-2 text-right font-medium'>
                  Refunds
                </th>
                <th scope='col' className='py-2 text-right font-medium'>
                  Expenses
                </th>
                <th scope='col' className='py-2 text-right font-medium'>
                  Profit
                </th>
                <th scope='col' className='py-2 text-right font-medium'>
                  Visits
                </th>
              </tr>
            </thead>
            <tbody className='divide-border/60 divide-y tabular-nums'>
              {lines.toReversed().map((l, i) => (
                <tr key={l.month}>
                  <th scope='row' className='py-2.5 text-left font-normal'>
                    {monthLabel(l.month, 'long')}
                    {i === 0 && (
                      <span className='text-muted-foreground ml-1.5 text-xs'>so far</span>
                    )}
                  </th>
                  <td className='py-2.5 text-right'>
                    {formatCents(l.serviceCents, { whole: true })}
                  </td>
                  <td className='py-2.5 text-right'>{formatCents(l.tipCents, { whole: true })}</td>
                  <td className='py-2.5 text-right'>
                    {l.refundCents ? `−${formatCents(l.refundCents, { whole: true })}` : '—'}
                  </td>
                  <td className='py-2.5 text-right'>
                    −{formatCents(l.expenseCents, { whole: true })}
                  </td>
                  <td
                    className={cn(
                      'py-2.5 text-right font-medium',
                      l.profitCents < 0 && 'text-destructive'
                    )}
                  >
                    {formatCents(l.profitCents, { whole: true })}
                  </td>
                  <td className='py-2.5 text-right'>{l.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className='text-muted-foreground mt-3 text-xs'>
          Income is counted when it’s received; deposits count in the month they were paid.
        </p>
      </SectionCard>
    </PageContainer>
  );
}
