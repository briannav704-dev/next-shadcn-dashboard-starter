import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { Pager } from '@/components/lux/pager';
import { SectionCard } from '@/components/lux/section-card';
import { StatCard } from '@/components/lux/stat-card';
import {
  EXPENSE_CATEGORY_LABEL,
  FORMS,
  PAYMENT_KIND_LABEL,
  PAYMENT_METHOD_LABEL
} from '@/features/kouture/forms';
import { formatVisitDate } from '@/features/kouture/lib/format';
import { monthLabel } from '@/features/kouture/lib/insights';
import { signedAmount } from '@/features/kouture/lib/summary';
import { endOfMonth, shiftMonth } from '@/features/life/lib/modules';
import { addDays, startOfDayInZone, startOfMonth, todayKey } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { requestNow, requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Revenue & expenses' };

type PageProps = { searchParams: Promise<{ month?: string }> };

export default async function MoneyPage({ searchParams }: PageProps) {
  const { repos, profile } = await requireOwnerPage();
  const tz = profile.timezone;
  const today = todayKey(tz);
  const { month: raw } = await searchParams;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : startOfMonth(today);
  const last = endOfMonth(month);
  const { entities } = repos;
  const [payments, expenses, appointments, clients] = await Promise.all([
    entities('kouture.payments').list({
      range: {
        field: 'receivedAt',
        gte: startOfDayInZone(month, tz).toISOString(),
        lt: startOfDayInZone(addDays(last, 1), tz).toISOString()
      },
      order: [{ field: 'receivedAt', ascending: false }]
    }),
    entities('kouture.expenses').list({
      range: { field: 'spentOn', gte: month, lte: last },
      order: [{ field: 'spentOn', ascending: false }]
    }),
    entities('kouture.appointments').list({
      range: {
        field: 'startsAt',
        gte: startOfDayInZone(addDays(month, -60), tz).toISOString(),
        lt: startOfDayInZone(addDays(last, 1), tz).toISOString()
      }
    }),
    entities('kouture.clients').list()
  ]);
  const clientName = new Map(clients.map((c) => [c.id, c.fullName]));
  const apptClient = new Map(appointments.map((a) => [a.id, a.clientId ?? null]));
  const who = (p: (typeof payments)[number]) => {
    const id = p.clientId ?? (p.appointmentId ? apptClient.get(p.appointmentId) : null);
    return (id && clientName.get(id)) || 'Walk-in';
  };

  const income = payments.reduce((s, p) => s + signedAmount(p), 0);
  const spent = expenses.reduce((s, e) => s + e.amountCents, 0);
  const card = payments
    .filter((p) => p.method === 'stripe')
    .reduce((s, p) => s + signedAmount(p), 0);
  const tips = payments.filter((p) => p.kind === 'tip').reduce((s, p) => s + p.amountCents, 0);
  const byCategory = Object.entries(EXPENSE_CATEGORY_LABEL)
    .map(([key, label]) => ({
      label,
      cents: expenses.filter((e) => e.category === key).reduce((s, e) => s + e.amountCents, 0)
    }))
    .filter((c) => c.cents > 0)
    .toSorted((a, b) => b.cents - a.cents);

  return (
    <PageContainer
      eyebrow='Kouture · Money'
      pageTitle='Revenue & expenses'
      pageHeaderAction={
        <div className='flex flex-wrap items-center gap-2'>
          <Pager
            label={monthLabel(month, 'long')}
            prevHref={`/kouture/money?month=${shiftMonth(month, -1).slice(0, 7)}`}
            nextHref={`/kouture/money?month=${shiftMonth(month, 1).slice(0, 7)}`}
            todayHref='/kouture/money'
            isCurrent={month === startOfMonth(today)}
          />
          <AddButton
            entity='kouture.expenses'
            label='Expense'
            title='New expense'
            fields={FORMS.expense}
            initial={{ spentOn: today, category: 'supplies' }}
          />
          <AddButton
            entity='kouture.payments'
            variant='outline'
            label='Payment'
            title='Record a payment'
            fields={FORMS.payment}
            initial={{ kind: 'balance', method: 'cash', receivedAt: requestNow().toISOString() }}
          />
        </div>
      }
    >
      <div className='grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4'>
        <StatCard
          label='Money in'
          icon='cash'
          value={formatCents(income, { whole: true })}
          hint={`${formatCents(tips, { whole: true })} in tips`}
        />
        <StatCard label='Expenses' icon='receipt' value={formatCents(spent, { whole: true })} />
        <StatCard
          label='Profit'
          icon={income - spent >= 0 ? 'trendingUp' : 'trendingDown'}
          value={formatCents(income - spent, { whole: true })}
          hint={income > 0 ? `${Math.round(((income - spent) / income) * 100)}% margin` : undefined}
        />
        <StatCard
          label='Card vs cash'
          icon='billing'
          value={formatCents(card, { whole: true })}
          hint={`card · ${formatCents(income - card, { whole: true })} cash`}
        />
      </div>

      <div className='mt-5 grid gap-5 lg:grid-cols-12'>
        <div className='lg:col-span-7'>
          <SectionCard title='Payments' eyebrow={`${payments.length} this month`}>
            {payments.length === 0 ? (
              <EmptyNote>
                No payments recorded. Check out a visit to record deposit, balance and tip together.
              </EmptyNote>
            ) : (
              <ul className='divide-border/60 divide-y'>
                {payments.map((p) => (
                  <li key={p.id} className='flex items-center gap-3 py-2.5'>
                    <span className='text-muted-foreground w-14 shrink-0 text-xs tabular-nums'>
                      {formatVisitDate(p.receivedAt, tz)}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm'>{who(p)}</p>
                      <p className='text-muted-foreground truncate text-xs'>
                        {PAYMENT_KIND_LABEL[p.kind]} · {PAYMENT_METHOD_LABEL[p.method]}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-sm tabular-nums',
                        p.kind === 'refund' ? 'text-destructive' : ''
                      )}
                    >
                      {p.kind === 'refund' ? '−' : ''}
                      {formatCents(p.amountCents)}
                    </span>
                    <RowActions
                      entity='kouture.payments'
                      id={p.id}
                      label={`${PAYMENT_KIND_LABEL[p.kind]} from ${who(p)}`}
                      fields={FORMS.payment}
                      values={p}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
        <div className='flex flex-col gap-5 lg:col-span-5'>
          <SectionCard title='Where it went' eyebrow='By category'>
            {byCategory.length === 0 ? (
              <EmptyNote>No expenses this month.</EmptyNote>
            ) : (
              <ul className='space-y-3'>
                {byCategory.map((c) => (
                  <li key={c.label}>
                    <div className='flex justify-between text-sm'>
                      <span>{c.label}</span>
                      <span className='tabular-nums'>{formatCents(c.cents, { whole: true })}</span>
                    </div>
                    <div className='bg-blush mt-1.5 h-1.5 overflow-hidden rounded-full' aria-hidden>
                      <div
                        className='bg-rose h-full rounded-full'
                        style={{ width: `${(c.cents / spent) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard title='Expenses' eyebrow={`${expenses.length} this month`}>
            {expenses.length === 0 ? (
              <EmptyNote>Add rent, supplies and subscriptions to see true profit.</EmptyNote>
            ) : (
              <ul className='divide-border/60 divide-y'>
                {expenses.map((e) => (
                  <li key={e.id} className='flex items-center gap-3 py-2.5'>
                    <span className='text-muted-foreground w-14 shrink-0 text-xs tabular-nums'>
                      {formatVisitDate(`${e.spentOn}T12:00:00Z`, 'UTC')}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm'>
                        {e.vendor ?? e.description ?? EXPENSE_CATEGORY_LABEL[e.category]}
                      </p>
                      <p className='text-muted-foreground truncate text-xs'>
                        {EXPENSE_CATEGORY_LABEL[e.category]}
                      </p>
                    </div>
                    <span className='shrink-0 text-sm tabular-nums'>
                      {formatCents(e.amountCents)}
                    </span>
                    <RowActions
                      entity='kouture.expenses'
                      id={e.id}
                      label={e.vendor ?? EXPENSE_CATEGORY_LABEL[e.category]}
                      fields={FORMS.expense}
                      values={e}
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
