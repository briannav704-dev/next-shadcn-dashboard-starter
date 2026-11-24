import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { Pager } from '@/components/lux/pager';
import { SectionCard } from '@/components/lux/section-card';
import { EVENT_CATEGORY_LABEL, FORMS } from '@/features/life/forms';
import { monthGrid, shiftMonth } from '@/features/life/lib/modules';
import { addDays, dayKey, formatTime, startOfDayInZone, startOfMonth, todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { RowOf } from '@/server/entities/definitions';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Calendar' };

const DOT: Record<RowOf<'life.events'>['category'], string> = {
  personal: 'bg-taupe',
  self_care: 'bg-rose',
  fitness: 'bg-champagne',
  travel: 'bg-chart-3',
  social: 'bg-chart-4',
  other: 'bg-muted-foreground'
};

type PageProps = { searchParams: Promise<{ month?: string }> };

export default async function CalendarPage({ searchParams }: PageProps) {
  const { repos, profile } = await requireOwnerPage();
  const tz = profile.timezone;
  const today = todayKey(tz);
  const { month: raw } = await searchParams;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : startOfMonth(today);
  const weeks = monthGrid(month);
  const gridStart = weeks[0][0];
  const gridEnd = addDays(weeks.at(-1)!.at(-1)!, 1);
  const events = await repos.entities('life.events').list({
    range: {
      field: 'startsAt',
      gte: startOfDayInZone(gridStart, tz).toISOString(),
      lt: startOfDayInZone(gridEnd, tz).toISOString()
    },
    order: [{ field: 'startsAt' }]
  });
  const byDay = new Map<string, typeof events>();
  for (const e of events) {
    const key = dayKey(new Date(e.startsAt), tz);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${month}T12:00:00Z`));
  const inMonth = events.filter(
    (e) => dayKey(new Date(e.startsAt), tz).slice(0, 7) === month.slice(0, 7)
  );
  const defaultStart = new Date(
    startOfDayInZone(today, tz).getTime() + 10 * 3_600_000
  ).toISOString();

  return (
    <PageContainer
      eyebrow='My Life'
      pageTitle='Calendar'
      pageHeaderAction={
        <div className='flex flex-wrap items-center gap-3'>
          <Pager
            label={monthLabel}
            prevHref={`/life/calendar?month=${shiftMonth(month, -1).slice(0, 7)}`}
            nextHref={`/life/calendar?month=${shiftMonth(month, 1).slice(0, 7)}`}
            todayHref='/life/calendar'
            isCurrent={month === startOfMonth(today)}
          />
          <AddButton
            entity='life.events'
            label='New event'
            title='New event'
            fields={FORMS.event}
            initial={{
              startsAt: defaultStart,
              endsAt: new Date(Date.parse(defaultStart) + 3_600_000).toISOString(),
              category: 'personal'
            }}
          />
        </div>
      }
    >
      <section className='lux-card overflow-hidden' aria-label={monthLabel}>
        <div className='text-muted-foreground grid grid-cols-7 border-b text-center text-[0.65rem] font-medium tracking-[0.14em] uppercase'>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className='py-2.5'>
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className='grid grid-cols-7 border-b last:border-b-0'>
            {week.map((day) => {
              const list = byDay.get(day) ?? [];
              const outside = day.slice(0, 7) !== month.slice(0, 7);
              const isToday = day === today;
              return (
                <div
                  key={day}
                  className={cn(
                    'min-h-16 border-r p-1.5 last:border-r-0 md:min-h-28 md:p-2',
                    outside && 'bg-muted/40',
                    isToday && 'bg-blush/50'
                  )}
                >
                  <span
                    className={cn(
                      'font-display inline-grid size-7 place-items-center rounded-full text-base',
                      outside && 'text-muted-foreground/60',
                      isToday && 'bg-rose text-primary-foreground'
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <ul className='mt-1 hidden space-y-1 md:block'>
                    {list.slice(0, 3).map((e) => (
                      <li
                        key={e.id}
                        className='flex items-center gap-1.5 truncate text-[0.7rem] leading-tight'
                      >
                        <span
                          className={cn('size-1.5 shrink-0 rounded-full', DOT[e.category])}
                          aria-hidden
                        />
                        <span className='truncate'>
                          <span className='text-muted-foreground'>
                            {formatTime(e.startsAt, tz)}
                          </span>{' '}
                          {e.title}
                        </span>
                      </li>
                    ))}
                    {list.length > 3 && (
                      <li className='text-muted-foreground text-[0.65rem]'>
                        +{list.length - 3} more
                      </li>
                    )}
                  </ul>
                  <div className='mt-1 flex gap-0.5 md:hidden' aria-label={`${list.length} events`}>
                    {list.slice(0, 3).map((e) => (
                      <span key={e.id} className={cn('size-1.5 rounded-full', DOT[e.category])} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <SectionCard title='This month' eyebrow={`${inMonth.length} events`} className='mt-5'>
        {inMonth.length === 0 ? (
          <EmptyNote>Nothing scheduled this month.</EmptyNote>
        ) : (
          <ul className='divide-border/60 divide-y'>
            {inMonth.map((e) => {
              const key = dayKey(new Date(e.startsAt), tz);
              return (
                <li key={e.id} className='flex items-center gap-3 py-2.5'>
                  <span
                    className={cn('h-9 w-1 shrink-0 rounded-full', DOT[e.category])}
                    aria-hidden
                  />
                  <div className='w-20 shrink-0'>
                    <p className='font-display text-lg leading-none'>
                      {new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC'
                      }).format(new Date(`${key}T12:00:00Z`))}
                    </p>
                    <p className='text-muted-foreground text-xs'>{formatTime(e.startsAt, tz)}</p>
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>{e.title}</p>
                    <p className='text-muted-foreground truncate text-xs'>
                      {EVENT_CATEGORY_LABEL[e.category]}
                      {e.location ? ` · ${e.location}` : ''}
                    </p>
                  </div>
                  <RowActions
                    entity='life.events'
                    id={e.id}
                    label={e.title}
                    fields={FORMS.event}
                    values={e}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </PageContainer>
  );
}
