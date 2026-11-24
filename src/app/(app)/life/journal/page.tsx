import type { Metadata } from 'next';
import Link from 'next/link';

import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { Pager } from '@/components/lux/pager';
import { SectionCard } from '@/components/lux/section-card';
import { moodSummary } from '@/features/life/lib/modules';
import { MOODS } from '@/features/life/forms';
import { JournalEditor } from '@/features/life/modules/journal-editor';
import { addDays, formatDayLong, todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Journal' };

type PageProps = { searchParams: Promise<{ day?: string }> };

export default async function JournalPage({ searchParams }: PageProps) {
  const { repos, profile } = await requireOwnerPage();
  const today = todayKey(profile.timezone);
  const { day: raw } = await searchParams;
  const day = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
  const entries = await repos.entities('life.journal_entries').list({
    range: { field: 'entryOn', gte: addDays(today, -120), lte: today },
    order: [{ field: 'entryOn', ascending: false }]
  });
  const entry = entries.find((e) => e.entryOn === day) ?? null;
  const mood = moodSummary(entries, today);
  const moodLabel = mood.average ? MOODS[Math.round(mood.average) - 1].label : '—';

  return (
    <PageContainer
      eyebrow='My Life · Dreams'
      pageTitle='Journal'
      pageDescription={formatDayLong(day)}
      pageHeaderAction={
        <Pager
          label={day === today ? 'Today' : formatDayLong(day).split(',')[0]}
          prevHref={`/life/journal?day=${addDays(day, -1)}`}
          nextHref={day < today ? `/life/journal?day=${addDays(day, 1)}` : '/life/journal'}
          todayHref='/life/journal'
          isCurrent={day === today}
        />
      }
    >
      <div className='grid gap-5 lg:grid-cols-12'>
        <section className='lux-card p-5 md:p-7 lg:col-span-8' aria-label='Journal entry'>
          <JournalEditor key={day} day={day} initial={entry} />
        </section>
        <div className='flex flex-col gap-5 lg:col-span-4'>
          <SectionCard title='Your rhythm' eyebrow='Last 30 days'>
            <dl className='grid grid-cols-3 gap-3 text-center'>
              {[
                ['Mood', moodLabel],
                ['Entries', String(mood.count)],
                ['Streak', `${mood.streak}d`]
              ].map(([label, value]) => (
                <div key={label} className='bg-muted/60 rounded-xl px-2 py-3'>
                  <dd className='font-display text-2xl leading-none'>{value}</dd>
                  <dt className='text-muted-foreground mt-1 text-[0.65rem] tracking-[0.12em] uppercase'>
                    {label}
                  </dt>
                </div>
              ))}
            </dl>
          </SectionCard>
          <SectionCard title='Past entries' eyebrow='Memories'>
            {entries.length === 0 ? (
              <EmptyNote>Your first entry starts the story.</EmptyNote>
            ) : (
              <ul className='-mx-2 space-y-0.5'>
                {entries.slice(0, 12).map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/life/journal?day=${e.entryOn}`}
                      aria-current={e.entryOn === day ? 'page' : undefined}
                      className={cn(
                        'hover:bg-muted/70 flex items-center gap-3 rounded-lg px-2 py-2',
                        e.entryOn === day && 'bg-blush/50'
                      )}
                    >
                      <span
                        className='flex shrink-0 gap-0.5'
                        aria-label={e.mood ? `Mood ${MOODS[e.mood - 1].label}` : 'No mood'}
                      >
                        {Array.from({ length: 5 }, (_, i) => (
                          <span
                            key={i}
                            className={cn(
                              'size-1.5 rounded-full',
                              e.mood && i < e.mood ? 'bg-rose' : 'bg-blush'
                            )}
                          />
                        ))}
                      </span>
                      <span className='min-w-0 flex-1'>
                        <span className='block truncate text-sm'>
                          {e.title ?? (e.body ? e.body.slice(0, 60) : 'Untitled')}
                        </span>
                        <span className='text-muted-foreground text-xs'>
                          {formatDayLong(e.entryOn)}
                        </span>
                      </span>
                    </Link>
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
