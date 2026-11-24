import type { Metadata } from 'next';
import Link from 'next/link';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { StatCard } from '@/components/lux/stat-card';
import { FORMS, WORKOUT_KIND_LABEL } from '@/features/life/forms';
import { fitnessSummary } from '@/features/life/lib/modules';
import { WeeklyMinutesChart } from '@/features/life/modules/weekly-minutes-chart';
import { addDays, relativeDayLabel, todayKey } from '@/lib/dates';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Fitness' };

export default async function FitnessPage() {
  const { repos, profile } = await requireOwnerPage();
  const today = todayKey(profile.timezone);
  const logs = await repos.entities('life.workout_logs').list({
    range: { field: 'performedOn', gte: addDays(today, -70), lte: today },
    order: [{ field: 'performedOn', ascending: false }]
  });
  const s = fitnessSummary(logs, today);
  const maxKind = Math.max(1, ...s.last30ByKind.map((k) => k.minutes));

  return (
    <PageContainer
      eyebrow='My Life · Wellness'
      pageTitle='Fitness'
      pageDescription='Every session counts.'
      pageHeaderAction={
        <div className='flex gap-2'>
          <Link
            href='/life/workouts'
            className='border-border hover:bg-card inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium'
          >
            Workout plan
          </Link>
          <AddButton
            entity='life.workout_logs'
            label='Log workout'
            title='Log a workout'
            fields={FORMS.workoutLog}
            initial={{
              performedOn: today,
              kind: 'pilates',
              intensity: 'moderate',
              durationMinutes: 45
            }}
          />
        </div>
      }
    >
      <div className='grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4'>
        <StatCard
          label='This week'
          icon='fitness'
          value={`${s.thisWeekMinutes} min`}
          hint={`${s.thisWeekSessions} sessions`}
        />
        <StatCard
          label='Active streak'
          icon='heart'
          value={`${s.streakWeeks} wk`}
          hint='weeks in a row with a workout'
        />
        <StatCard
          label='Weekly average'
          icon='analytics'
          value={`${Math.round(s.series.reduce((sum, w) => sum + w.minutes, 0) / s.series.length)} min`}
          hint='last 8 weeks'
        />
        <StatCard
          label='Sessions'
          icon='calendarEvent'
          value={String(s.series.reduce((sum, w) => sum + w.sessions, 0))}
          hint='last 8 weeks'
        />
      </div>
      <div className='mt-5 grid gap-5 lg:grid-cols-12'>
        <div className='lg:col-span-7'>
          <SectionCard title='Minutes per week' eyebrow='Last 8 weeks'>
            <WeeklyMinutesChart series={s.series} />
          </SectionCard>
        </div>
        <div className='lg:col-span-5'>
          <SectionCard title='Your mix' eyebrow='Last 30 days'>
            {s.last30ByKind.length === 0 ? (
              <EmptyNote>Log a workout to see your mix.</EmptyNote>
            ) : (
              <ul className='space-y-3'>
                {s.last30ByKind.map((k) => (
                  <li key={k.kind}>
                    <div className='flex justify-between text-sm'>
                      <span>{WORKOUT_KIND_LABEL[k.kind as keyof typeof WORKOUT_KIND_LABEL]}</span>
                      <span className='text-muted-foreground tabular-nums'>{k.minutes} min</span>
                    </div>
                    <div className='bg-muted mt-1 h-1.5 overflow-hidden rounded-full'>
                      <div
                        className='bg-chart-1 h-full rounded-full'
                        style={{ width: `${(k.minutes / maxKind) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
        <div className='lg:col-span-12'>
          <SectionCard title='Workout log' eyebrow='Recent'>
            {logs.length === 0 ? (
              <EmptyNote>No workouts logged yet.</EmptyNote>
            ) : (
              <ul className='divide-border/60 divide-y'>
                {logs.slice(0, 20).map((l) => (
                  <li key={l.id} className='flex items-center gap-3 py-2.5'>
                    <span className='text-muted-foreground w-20 shrink-0 text-xs'>
                      {relativeDayLabel(l.performedOn, today) === 'Overdue'
                        ? l.performedOn.slice(5)
                        : relativeDayLabel(l.performedOn, today)}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm font-medium'>{l.title}</p>
                      <p className='text-muted-foreground text-xs capitalize'>
                        {WORKOUT_KIND_LABEL[l.kind]} · {l.intensity}
                      </p>
                    </div>
                    <span className='text-sm tabular-nums'>{l.durationMinutes} min</span>
                    <RowActions
                      entity='life.workout_logs'
                      id={l.id}
                      label={l.title}
                      fields={FORMS.workoutLog}
                      values={l}
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
