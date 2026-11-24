import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import type { FieldSpec } from '@/components/entity/entity-form-dialog';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { Pager } from '@/components/lux/pager';
import { SectionCard } from '@/components/lux/section-card';
import { SegmentLinks } from '@/components/lux/segment-links';
import { StatCard } from '@/components/lux/stat-card';
import { formatVisitDate } from '@/features/kouture/lib/format';
import { quarterlyDeadlines } from '@/features/kouture/lib/taxes';
import {
  DEFAULT_INCOME_TAX_RATE,
  INCOME_TAX_RATES,
  loadTaxYear
} from '@/features/kouture/server/load-taxes';
import { relativeDayLabel, todayKey } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Taxes' };

type PageProps = { searchParams: Promise<{ year?: string; rate?: string }> };

const paymentFields: FieldSpec[] = [
  {
    name: 'quarter',
    label: 'Quarter',
    type: 'select',
    numeric: true,
    required: true,
    half: true,
    options: [1, 2, 3, 4].map((q) => ({ value: String(q), label: `Q${q}` }))
  },
  {
    name: 'jurisdiction',
    label: 'Paid to',
    type: 'select',
    required: true,
    half: true,
    options: [
      { value: 'federal', label: 'IRS (federal)' },
      { value: 'state', label: 'State' }
    ]
  },
  { name: 'amountCents', label: 'Amount', type: 'money', required: true, half: true },
  { name: 'paidOn', label: 'Paid on', type: 'date', required: true, half: true },
  { name: 'note', label: 'Confirmation number or note', type: 'text' }
];

const CHECKLIST = [
  'Download the 1099-K from Stripe in January (card payments). Cash and tips are income too, even without a form.',
  'Keep receipts for supplies, rent, education and equipment. A photo is fine.',
  'Track business miles (supply runs, classes). The standard mileage rate is often worth more than people expect.',
  'Ask your preparer about a home-office deduction, self-employed health insurance, and a SEP-IRA or Solo 401(k).',
  'Bigger equipment (a UV lamp, a nail desk, a ventilation system) may be depreciated or written off in one year.',
  'If your state has income tax, it usually has its own estimated payments too.'
];

export default async function TaxesPage({ searchParams }: PageProps) {
  const session = await requireOwnerPage();
  const today = todayKey(session.profile.timezone);
  const currentYear = Number(today.slice(0, 4));
  const { year: rawYear, rate: rawRate } = await searchParams;
  const parsedYear = Number(rawYear);
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= currentYear + 1
      ? parsedYear
      : currentYear;
  const parsedRate = Number(rawRate);
  const rate = (INCOME_TAX_RATES as readonly number[]).includes(parsedRate)
    ? parsedRate
    : DEFAULT_INCOME_TAX_RATE;

  const { summary: s, taxPayments } = await loadTaxYear(session, year, rate);
  const paid = taxPayments.reduce((sum, p) => sum + p.amountCents, 0);
  const effectiveRate = s.netProfitCents > 0 ? s.setAsideCents / s.netProfitCents : 0;
  const quarters = quarterlyDeadlines(year);
  const nextDue = quarters.find((q) => q.due >= today);
  const href = (next: { year?: number; rate?: number }) => {
    const params = new URLSearchParams();
    const y = next.year ?? year;
    const r = next.rate ?? rate;
    if (y !== currentYear) params.set('year', String(y));
    if (r !== DEFAULT_INCOME_TAX_RATE) params.set('rate', String(r));
    const q = params.toString();
    return `/kouture/taxes${q ? `?${q}` : ''}`;
  };

  return (
    <PageContainer
      eyebrow='Kouture · Money'
      pageTitle='Taxes'
      pageDescription='What you’ve earned, what to set aside, and when quarterly payments are due. Estimates to plan with; your tax preparer has the final word.'
      pageHeaderAction={
        <div className='flex flex-wrap items-center gap-2'>
          <Pager
            label={String(year)}
            prevHref={href({ year: year - 1 })}
            nextHref={href({ year: Math.min(year + 1, currentYear + 1) })}
            todayHref={href({ year: currentYear })}
            isCurrent={year === currentYear}
          />
          <a
            href={`/kouture/taxes/export?year=${year}`}
            download
            className='border-input hover:bg-blush/60 inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors'
          >
            <Icons.download className='size-4' aria-hidden />
            For my preparer (CSV)
          </a>
        </div>
      }
    >
      <div className='grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4'>
        <StatCard
          label={year === currentYear ? 'Profit so far' : 'Profit'}
          icon='trendingUp'
          value={formatCents(s.netProfitCents, { whole: true })}
          hint={`${formatCents(s.grossReceiptsCents - s.refundsCents, { whole: true })} in − ${formatCents(s.expensesCents, { whole: true })} out`}
        />
        <StatCard
          label='Self-employment tax'
          icon='forms'
          value={formatCents(s.selfEmploymentTaxCents, { whole: true })}
          hint='Social Security + Medicare, est.'
        />
        <StatCard
          label='Set aside in total'
          icon='savings'
          value={formatCents(s.setAsideCents, { whole: true })}
          hint={`about ${Math.round(effectiveRate * 100)}% of profit`}
        />
        <StatCard
          label='Paid so far'
          icon='circleCheck'
          value={formatCents(paid, { whole: true })}
          hint={
            s.setAsideCents > paid
              ? `${formatCents(s.setAsideCents - paid, { whole: true })} still to cover`
              : 'you’re covered so far'
          }
        />
      </div>

      <div className='mt-5 grid gap-5 lg:grid-cols-12'>
        <div className='flex flex-col gap-5 lg:col-span-7'>
          <SectionCard
            title='Quarterly estimated payments'
            eyebrow={
              nextDue ? `Next due ${relativeDayLabel(nextDue.due, today)}` : `Tax year ${year}`
            }
            action={
              <AddButton
                entity='kouture.tax_payments'
                variant='ghost'
                label='Record'
                title='Record a tax payment'
                fields={paymentFields}
                fixed={{ taxYear: year }}
                initial={{ quarter: nextDue?.quarter ?? 4, jurisdiction: 'federal', paidOn: today }}
              />
            }
          >
            <ul className='divide-border/60 divide-y'>
              {quarters.map((q) => {
                const quarterNet =
                  s.byQuarter.find((b) => b.quarter === q.quarter)?.netProfitCents ?? 0;
                const suggested = Math.max(0, Math.round(quarterNet * effectiveRate));
                const paidThis = taxPayments
                  .filter((p) => p.quarter === q.quarter)
                  .reduce((sum, p) => sum + p.amountCents, 0);
                const past = q.due < today;
                const isNext = q === nextDue;
                return (
                  <li key={q.quarter} className='flex items-center gap-3 py-3'>
                    <span
                      className={cn(
                        'font-display grid size-10 shrink-0 place-items-center rounded-full text-lg',
                        isNext ? 'bg-rose text-primary-foreground' : 'bg-blush text-rose'
                      )}
                    >
                      Q{q.quarter}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <p className='text-sm font-medium'>
                        Due{' '}
                        {formatVisitDate(
                          `${q.due}T12:00:00Z`,
                          'UTC',
                          new Date(`${year}-06-01T12:00:00Z`)
                        )}
                        {isNext && (
                          <span className='bg-blush text-rose ml-2 rounded-full px-2 py-0.5 text-[0.7rem]'>
                            {['Today', 'Tomorrow'].includes(relativeDayLabel(q.due, today))
                              ? relativeDayLabel(q.due, today)
                              : 'Next'}
                          </span>
                        )}
                      </p>
                      <p className='text-muted-foreground text-xs'>Income from {q.covers}</p>
                    </div>
                    <div className='shrink-0 text-right'>
                      <p className='text-sm tabular-nums'>
                        {formatCents(suggested, { whole: true })}
                      </p>
                      <p
                        className={cn(
                          'text-xs tabular-nums',
                          paidThis >= suggested && paidThis > 0
                            ? 'text-success'
                            : past && suggested > 0
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                        )}
                      >
                        {paidThis > 0
                          ? `${formatCents(paidThis, { whole: true })} paid`
                          : past && suggested > 0
                            ? 'not recorded'
                            : 'suggested'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className='mt-4 flex flex-wrap items-center gap-3'>
              <a
                href='https://www.irs.gov/payments/direct-pay'
                target='_blank'
                rel='noopener noreferrer'
                className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-sm font-medium'
              >
                Pay the IRS (Direct Pay)
                <Icons.externalLink className='size-3.5' aria-hidden />
              </a>
              <p className='text-muted-foreground text-xs'>
                Choose “Estimated tax”, form 1040-ES, then record it here.
              </p>
            </div>
            {taxPayments.length > 0 && (
              <ul className='border-border/60 mt-4 space-y-1 border-t pt-3'>
                {taxPayments.map((p) => (
                  <li key={p.id} className='flex items-center gap-3 text-sm'>
                    <span className='text-muted-foreground w-16 shrink-0 text-xs'>
                      {formatVisitDate(`${p.paidOn}T12:00:00Z`, 'UTC')}
                    </span>
                    <span className='min-w-0 flex-1 truncate'>
                      Q{p.quarter} · {p.jurisdiction === 'federal' ? 'IRS' : 'State'}
                      {p.note && <span className='text-muted-foreground'> · {p.note}</span>}
                    </span>
                    <span className='tabular-nums'>{formatCents(p.amountCents)}</span>
                    <RowActions
                      entity='kouture.tax_payments'
                      id={p.id}
                      label={`Q${p.quarter} payment`}
                      fields={paymentFields}
                      values={p}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title='How much to set aside' eyebrow='Your choice'>
            <p className='text-muted-foreground mb-3 text-sm leading-relaxed'>
              Self-employment tax is fixed by law (15.3% of 92.35% of profit). Income tax depends on
              your whole household, so pick a rate for federal plus state income tax. 15% suits many
              solo salons; ask your preparer for yours.
            </p>
            <SegmentLinks
              label='Income tax set-aside rate'
              current={String(rate)}
              items={INCOME_TAX_RATES.map((r) => ({
                value: String(r),
                label: `${r}%`,
                href: href({ rate: r })
              }))}
            />
            <dl className='mt-4 grid grid-cols-2 gap-y-1.5 text-sm'>
              <dt className='text-muted-foreground'>Self-employment tax</dt>
              <dd className='text-right tabular-nums'>{formatCents(s.selfEmploymentTaxCents)}</dd>
              <dt className='text-muted-foreground'>Income tax at {rate}%</dt>
              <dd className='text-right tabular-nums'>{formatCents(s.incomeTaxSetAsideCents)}</dd>
              <dt className='font-medium'>Set aside</dt>
              <dd className='text-right font-medium tabular-nums'>
                {formatCents(s.setAsideCents)}
              </dd>
            </dl>
            <p className='text-muted-foreground mt-3 text-xs'>
              Half of the self-employment tax ({formatCents(s.seDeductionCents, { whole: true })})
              is deducted from your income, which the estimate already accounts for.
            </p>
          </SectionCard>
        </div>

        <div className='flex flex-col gap-5 lg:col-span-5'>
          <SectionCard title='Schedule C summary' eyebrow={`Tax year ${year}`}>
            <table className='w-full text-sm'>
              <caption className='sr-only'>Schedule C summary for {year}</caption>
              <tbody className='divide-border/60 divide-y tabular-nums'>
                <tr>
                  <th scope='row' className='py-2 text-left font-normal'>
                    <span className='text-muted-foreground mr-2 text-xs'>1</span>Gross receipts
                    (incl. tips)
                  </th>
                  <td className='py-2 text-right'>{formatCents(s.grossReceiptsCents)}</td>
                </tr>
                <tr>
                  <th scope='row' className='py-2 text-left font-normal'>
                    <span className='text-muted-foreground mr-2 text-xs'>2</span>Refunds
                  </th>
                  <td className='py-2 text-right'>
                    {s.refundsCents ? `−${formatCents(s.refundsCents)}` : '—'}
                  </td>
                </tr>
                {s.lines.map((l) => (
                  <tr key={`${l.line}-${l.label}`}>
                    <th scope='row' className='py-2 text-left font-normal'>
                      <span className='text-muted-foreground mr-2 text-xs'>{l.line}</span>
                      {l.label}
                    </th>
                    <td className='py-2 text-right'>−{formatCents(l.cents)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope='row' className='py-2 text-left font-medium'>
                    <span className='text-muted-foreground mr-2 text-xs'>31</span>Net profit
                  </th>
                  <td
                    className={cn(
                      'py-2 text-right font-medium',
                      s.netProfitCents < 0 && 'text-destructive'
                    )}
                  >
                    {formatCents(s.netProfitCents)}
                  </td>
                </tr>
              </tbody>
            </table>
            {s.lines.length === 0 && (
              <EmptyNote className='mt-3'>
                Add expenses under Revenue & expenses to lower your taxable profit.
              </EmptyNote>
            )}
            <p className='text-muted-foreground mt-3 text-xs'>
              Line numbers are where each category usually goes; your preparer confirms them.
            </p>
          </SectionCard>

          <SectionCard title='Card vs cash' eyebrow='For your 1099-K'>
            <dl className='grid grid-cols-2 gap-y-1.5 text-sm'>
              <dt className='text-muted-foreground'>Card (Stripe)</dt>
              <dd className='text-right tabular-nums'>{formatCents(s.cardCents)}</dd>
              <dt className='text-muted-foreground'>Cash and other</dt>
              <dd className='text-right tabular-nums'>{formatCents(s.cashCents)}</dd>
              <dt className='text-muted-foreground'>Tips included</dt>
              <dd className='text-right tabular-nums'>{formatCents(s.tipsCents)}</dd>
            </dl>
            <p className='text-muted-foreground mt-3 text-xs leading-relaxed'>
              If Stripe sends you a 1099-K, its total should be close to the card line. Cash is
              reported too, so recording every checkout keeps you covered.
            </p>
          </SectionCard>

          <SectionCard title='Before you file' eyebrow='Checklist'>
            <ul className='space-y-2.5'>
              {CHECKLIST.map((item) => (
                <li key={item} className='flex gap-2.5 text-sm leading-relaxed'>
                  <Icons.check className='text-rose mt-1 size-3.5 shrink-0' aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>

      <p className='text-muted-foreground mt-5 text-xs leading-relaxed'>
        These are planning estimates from what you’ve recorded in Kouture, not tax advice. They
        assume a US sole proprietor filing Schedule C, round amounts, and don’t include deductions
        or credits outside the salon. Federal holidays can shift a due date by a day.
      </p>
    </PageContainer>
  );
}
