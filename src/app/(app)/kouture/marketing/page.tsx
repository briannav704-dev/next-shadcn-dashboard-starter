import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { Pager } from '@/components/lux/pager';
import { SectionCard } from '@/components/lux/section-card';
import { ChannelDot, StatusPill } from '@/features/kouture/components/marketing-chip';
import { FORMS, MARKETING_CHANNEL_LABEL, MARKETING_KIND_LABEL } from '@/features/kouture/forms';
import { monthLabel } from '@/features/kouture/lib/insights';
import { endOfMonth, monthGrid, shiftMonth } from '@/features/life/lib/modules';
import { formatDayLong, startOfMonth, todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { RowOf } from '@/server/entities/definitions';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Marketing calendar' };

type PageProps = { searchParams: Promise<{ month?: string }> };

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Item = RowOf<'kouture.marketing_items'>;

function MarketingActions({ item }: { item: Item }) {
  return (
    <RowActions
      entity='kouture.marketing_items'
      id={item.id}
      label={item.title}
      fields={FORMS.marketing}
      values={item}
      extra={
        item.status !== 'published'
          ? [{ label: 'Mark published', icon: 'check', patch: { status: 'published' } }]
          : []
      }
    />
  );
}

export default async function MarketingPage({ searchParams }: PageProps) {
  const { repos, profile } = await requireOwnerPage();
  const today = todayKey(profile.timezone);
  const { month: raw } = await searchParams;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : startOfMonth(today);
  const weeks = monthGrid(month);
  const items = repos.entities('kouture.marketing_items');
  const [scheduled, unscheduled] = await Promise.all([
    items.list({
      range: { field: 'scheduledOn', gte: weeks[0][0], lte: weeks.at(-1)![6] },
      order: [{ field: 'scheduledOn' }]
    }),
    items.list({ eq: { scheduledOn: null }, order: [{ field: 'title' }] })
  ]);
  const byDay = new Map<string, typeof scheduled>();
  for (const item of scheduled) {
    byDay.set(item.scheduledOn!, [...(byDay.get(item.scheduledOn!) ?? []), item]);
  }
  const inMonth = scheduled.filter(
    (i) => i.scheduledOn! >= month && i.scheduledOn! <= endOfMonth(month)
  );

  return (
    <PageContainer
      eyebrow='Kouture · Growth'
      pageTitle='Marketing calendar'
      pageDescription='Campaigns, promos, posts and client messages in one place.'
      pageHeaderAction={
        <div className='flex flex-wrap items-center gap-2'>
          <Pager
            label={monthLabel(month, 'long')}
            prevHref={`/kouture/marketing?month=${shiftMonth(month, -1).slice(0, 7)}`}
            nextHref={`/kouture/marketing?month=${shiftMonth(month, 1).slice(0, 7)}`}
            todayHref='/kouture/marketing'
            isCurrent={month === startOfMonth(today)}
          />
          <AddButton
            entity='kouture.marketing_items'
            label='Add'
            title='New marketing item'
            fields={FORMS.marketing}
            initial={{ channel: 'instagram', kind: 'post', status: 'idea', scheduledOn: today }}
          />
        </div>
      }
    >
      <section aria-label='Month calendar' className='lux-card hidden overflow-hidden md:block'>
        <div className='text-muted-foreground grid grid-cols-7 border-b text-center text-xs'>
          {WEEKDAYS.map((d) => (
            <div key={d} className='py-2'>
              {d}
            </div>
          ))}
        </div>
        <div className='grid grid-cols-7'>
          {weeks.flat().map((day) => {
            const list = byDay.get(day) ?? [];
            const outside = day.slice(0, 7) !== month.slice(0, 7);
            return (
              <div
                key={day}
                className={cn(
                  'border-border/60 min-h-28 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0',
                  outside && 'bg-muted/30'
                )}
              >
                <p
                  className={cn(
                    'mb-1 text-xs tabular-nums',
                    day === today
                      ? 'bg-rose text-primary-foreground inline-grid size-6 place-items-center rounded-full'
                      : outside
                        ? 'text-muted-foreground/60'
                        : 'text-muted-foreground'
                  )}
                >
                  {Number(day.slice(8))}
                </p>
                <ul className='space-y-1'>
                  {list.map((item) => (
                    <li
                      key={item.id}
                      className='bg-blush/50 flex items-center gap-1 rounded-md px-1.5 py-1 text-[0.7rem] leading-tight'
                    >
                      <ChannelDot channel={item.channel} />
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate',
                          item.status === 'published' && 'text-muted-foreground line-through'
                        )}
                        title={item.title}
                      >
                        {item.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className='mt-5 grid gap-5 lg:grid-cols-12'>
        <div className='lg:col-span-7'>
          <SectionCard title='This month' eyebrow={`${inMonth.length} planned`}>
            {inMonth.length === 0 ? (
              <EmptyNote>Nothing planned this month yet.</EmptyNote>
            ) : (
              <ul className='divide-border/60 divide-y'>
                {inMonth.map((item) => (
                  <li key={item.id} className='flex items-center gap-3 py-2.5'>
                    <span className='text-muted-foreground w-20 shrink-0 text-xs'>
                      {formatDayLong(item.scheduledOn!).split(',')[0].slice(0, 3)}{' '}
                      {Number(item.scheduledOn!.slice(8))}
                    </span>
                    <ChannelDot channel={item.channel} />
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm'>{item.title}</p>
                      <p className='text-muted-foreground truncate text-xs'>
                        {MARKETING_CHANNEL_LABEL[item.channel]} · {MARKETING_KIND_LABEL[item.kind]}
                      </p>
                    </div>
                    <StatusPill status={item.status} />
                    <MarketingActions item={item} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
        <div className='lg:col-span-5'>
          <SectionCard title='Idea bank' eyebrow='Not scheduled'>
            {unscheduled.length === 0 ? (
              <EmptyNote>Save ideas without a date and schedule them later.</EmptyNote>
            ) : (
              <ul className='divide-border/60 divide-y'>
                {unscheduled.map((item) => (
                  <li key={item.id} className='flex items-center gap-3 py-2.5'>
                    <ChannelDot channel={item.channel} />
                    <p className='min-w-0 flex-1 truncate text-sm'>{item.title}</p>
                    <MarketingActions item={item} />
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
