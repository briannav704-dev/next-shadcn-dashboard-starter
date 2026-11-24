import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { Pager } from '@/components/lux/pager';
import { SectionCard } from '@/components/lux/section-card';
import { StatCard } from '@/components/lux/stat-card';
import { FORMS, categoryOptions, transactionFields } from '@/features/life/forms';
import { budgetSummary, endOfMonth, shiftMonth } from '@/features/life/lib/modules';
import { startOfMonth, todayKey } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Budget' };

type PageProps = { searchParams: Promise<{ month?: string }> };

export default async function BudgetPage({ searchParams }: PageProps) {
  const { repos, profile } = await requireOwnerPage();
  const today = todayKey(profile.timezone);
  const { month: raw } = await searchParams;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : startOfMonth(today);
  const [categories, transactions] = await Promise.all([
    repos.entities('life.budget_categories').list({ order: [{ field: 'sortOrder' }] }),
    repos.entities('life.transactions').list({
      range: { field: 'occurredOn', gte: month, lte: endOfMonth(month) },
      order: [{ field: 'occurredOn', ascending: false }]
    })
  ]);
  const s = budgetSummary(categories, transactions);
  const options = categoryOptions(categories);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const txFields = transactionFields(options);
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${month}T12:00:00Z`));
  const leftCents =
    s.plannedCents -
    s.lines.reduce((sum, l) => sum + (l.category.monthlyLimitCents ? l.spentCents : 0), 0);

  return (
    <PageContainer
      eyebrow='My Life · Money'
      pageTitle='Budget'
      pageHeaderAction={
        <div className='flex flex-wrap items-center gap-3'>
          <Pager
            label={monthLabel}
            prevHref={`/life/budget?month=${shiftMonth(month, -1).slice(0, 7)}`}
            nextHref={`/life/budget?month=${shiftMonth(month, 1).slice(0, 7)}`}
            todayHref='/life/budget'
            isCurrent={month === startOfMonth(today)}
          />
          <AddButton
            entity='life.transactions'
            label='Add'
            title='New transaction'
            fields={txFields}
            initial={{ occurredOn: today, kind: 'expense' }}
          />
        </div>
      }
    >
      <div className='grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4'>
        <StatCard
          label='Money in'
          icon='wallet'
          value={formatCents(s.incomeCents, { whole: true })}
        />
        <StatCard
          label='Spent'
          icon='receipt'
          value={formatCents(s.expenseCents, { whole: true })}
        />
        <StatCard
          label='Left in budget'
          icon='savings'
          value={formatCents(leftCents, { whole: true })}
          hint={`of ${formatCents(s.plannedCents, { whole: true })} planned`}
        />
        <StatCard
          label='Net'
          icon={s.netCents >= 0 ? 'trendingUp' : 'trendingDown'}
          value={formatCents(s.netCents, { whole: true })}
          hint={s.netCents >= 0 ? 'saved this month' : 'over income'}
        />
      </div>

      <div className='mt-5 grid gap-5 lg:grid-cols-12'>
        <div className='lg:col-span-5'>
          <SectionCard
            title='Categories'
            eyebrow='Plan'
            action={
              <AddButton
                entity='life.budget_categories'
                variant='ghost'
                label='Add'
                title='New category'
                fields={FORMS.budgetCategory}
                initial={{ kind: 'expense' }}
                fixed={{ sortOrder: categories.length }}
              />
            }
          >
            {s.lines.length === 0 ? (
              <EmptyNote>Add categories to give every dollar a job.</EmptyNote>
            ) : (
              <ul className='space-y-4'>
                {s.lines.map(({ category, spentCents, usage }) => {
                  const over = usage !== null && usage > 1;
                  return (
                    <li key={category.id}>
                      <div className='flex items-center justify-between gap-2'>
                        <p className='truncate text-sm font-medium'>{category.name}</p>
                        <div className='flex items-center gap-1'>
                          <p
                            className={cn(
                              'text-xs tabular-nums',
                              over ? 'text-destructive' : 'text-muted-foreground'
                            )}
                          >
                            {formatCents(spentCents, { whole: true })}
                            {category.monthlyLimitCents
                              ? ` / ${formatCents(category.monthlyLimitCents, { whole: true })}`
                              : ''}
                          </p>
                          <RowActions
                            entity='life.budget_categories'
                            id={category.id}
                            label={category.name}
                            fields={FORMS.budgetCategory}
                            values={category}
                          />
                        </div>
                      </div>
                      {usage !== null && (
                        <div
                          className='bg-blush mt-1.5 h-1.5 overflow-hidden rounded-full'
                          role='progressbar'
                          aria-label={category.name}
                          aria-valuenow={Math.round(usage * 100)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className={cn(
                              'h-full rounded-full',
                              over ? 'bg-destructive' : usage > 0.85 ? 'bg-champagne' : 'bg-rose'
                            )}
                            style={{ width: `${Math.min(1, usage) * 100}%` }}
                          />
                        </div>
                      )}
                      {over && (
                        <p className='text-destructive mt-1 text-xs'>
                          Over by{' '}
                          {formatCents(spentCents - (category.monthlyLimitCents ?? 0), {
                            whole: true
                          })}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
        <div className='lg:col-span-7'>
          <SectionCard title='Transactions' eyebrow={`${transactions.length} this month`}>
            {transactions.length === 0 ? (
              <EmptyNote>No transactions this month.</EmptyNote>
            ) : (
              <ul className='divide-border/60 divide-y'>
                {transactions.map((t) => (
                  <li key={t.id} className='flex items-center gap-3 py-2.5'>
                    <span className='text-muted-foreground w-12 shrink-0 text-xs tabular-nums'>
                      {new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC'
                      }).format(new Date(`${t.occurredOn}T12:00:00Z`))}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm'>{t.description}</p>
                      <p className='text-muted-foreground truncate text-xs'>
                        {t.categoryId ? names.get(t.categoryId) : 'Uncategorized'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-sm tabular-nums',
                        t.kind === 'income' ? 'text-success' : ''
                      )}
                    >
                      {t.kind === 'income' ? '+' : '−'}
                      {formatCents(t.amountCents)}
                    </span>
                    <RowActions
                      entity='life.transactions'
                      id={t.id}
                      label={t.description}
                      fields={txFields}
                      values={t}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
