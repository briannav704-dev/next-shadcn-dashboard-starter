import Link from 'next/link';
import { SectionCard } from '@/components/lux/section-card';
import { EmptyNote } from '@/components/lux/empty-note';
import { addDays, dayKey, daysBetween, formatDayShort, formatTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { LifeEvent } from '@/server/data/types';

const CATEGORY_STYLE: Record<LifeEvent['category'], string> = {
  personal: 'bg-taupe',
  self_care: 'bg-rose',
  fitness: 'bg-champagne',
  travel: 'bg-chart-5',
  social: 'bg-chart-4',
  other: 'bg-muted-foreground'
};

const CATEGORY_LABEL: Record<LifeEvent['category'], string> = {
  personal: 'Personal',
  self_care: 'Self-care',
  fitness: 'Fitness',
  travel: 'Travel',
  social: 'Social',
  other: 'Other'
};

export function WeekStrip({
  events,
  today,
  timeZone
}: {
  events: LifeEvent[];
  today: string;
  timeZone: string;
}) {
  const days = daysBetween(today, addDays(today, 6));
  const byDay = new Map<string, LifeEvent[]>();
  for (const e of events) {
    const key = dayKey(new Date(e.startsAt), timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }
  const agenda = events
    .filter((e) => dayKey(new Date(e.startsAt), timeZone) <= days[6])
    .slice(0, 5);

  return (
    <SectionCard
      title='Your week'
      eyebrow='Calendar'
      action={
        <Link href='/life/calendar' className='text-primary text-xs font-medium hover:underline'>
          Calendar
        </Link>
      }
    >
      <ol className='grid grid-cols-7 gap-1.5' aria-label='Next seven days'>
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          const isToday = day === today;
          return (
            <li
              key={day}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-center transition-colors',
                isToday ? 'border-champagne/70 bg-blush/60' : 'border-transparent bg-muted/60'
              )}
            >
              <span className='text-muted-foreground text-[0.62rem] font-medium tracking-[0.12em] uppercase'>
                {formatDayShort(day)}
              </span>
              <span
                className={cn(
                  'font-display text-xl leading-none tabular-nums',
                  isToday && 'text-rose'
                )}
              >
                {Number(day.slice(8, 10))}
              </span>
              <span className='flex h-1.5 gap-0.5' aria-label={`${list.length} events`}>
                {list.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className={cn('size-1.5 rounded-full', CATEGORY_STYLE[e.category])}
                  />
                ))}
              </span>
            </li>
          );
        })}
      </ol>
      <div className='mt-5 space-y-2'>
        {agenda.length === 0 ? (
          <EmptyNote>A wide-open week. Enjoy it.</EmptyNote>
        ) : (
          agenda.map((e) => {
            const key = dayKey(new Date(e.startsAt), timeZone);
            return (
              <div key={e.id} className='flex items-center gap-3 rounded-lg px-1 py-1.5'>
                <span
                  className={cn('h-9 w-1 shrink-0 rounded-full', CATEGORY_STYLE[e.category])}
                  aria-hidden
                />
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium'>{e.title}</p>
                  <p className='text-muted-foreground truncate text-xs'>
                    {key === today ? 'Today' : formatDayShort(key)} ·{' '}
                    {formatTime(e.startsAt, timeZone)}
                    {e.location ? ` · ${e.location}` : ''}
                  </p>
                </div>
                <span className='text-muted-foreground hidden text-[0.65rem] tracking-wide uppercase sm:inline'>
                  {CATEGORY_LABEL[e.category]}
                </span>
              </div>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}
