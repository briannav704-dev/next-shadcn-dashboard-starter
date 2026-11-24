import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { FORMS } from '@/features/life/forms';
import { HabitsCard } from '@/features/life/components/habits-card';
import { bestStreak, buildHabitViews } from '@/features/life/lib/summary';
import { addDays, daysBetween, startOfWeek, todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Habits' };

const WEEKS = 12;

export default async function HabitsPage() {
  const { repos, profile } = await requireOwnerPage();
  const today = todayKey(profile.timezone);
  const gridStart = addDays(startOfWeek(today), -7 * (WEEKS - 1));
  const [habits, logs] = await Promise.all([
    repos.entities('life.habits').list({ order: [{ field: 'sortOrder' }] }),
    repos
      .entities('life.habit_logs')
      .list({ range: { field: 'loggedOn', gte: addDays(today, -365), lte: today } })
  ]);
  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);
  const logsBy = new Map<string, string[]>();
  for (const l of logs) logsBy.set(l.habitId, [...(logsBy.get(l.habitId) ?? []), l.loggedOn]);
  const views = buildHabitViews(
    active.map((h) => ({
      id: h.id,
      name: h.name,
      targetPerWeek: h.targetPerWeek,
      loggedDays: logsBy.get(h.id) ?? []
    })),
    today
  );
  const gridDays = daysBetween(gridStart, today);
  const last30 = addDays(today, -29);

  return (
    <PageContainer
      eyebrow='My Life'
      pageTitle='Habits'
      pageDescription='Small rituals, done beautifully and often.'
      pageHeaderAction={
        <AddButton
          entity='life.habits'
          label='New habit'
          title='New habit'
          fields={FORMS.habit}
          initial={{ targetPerWeek: 7 }}
          fixed={{ sortOrder: habits.length }}
        />
      }
    >
      <div className='grid gap-5 lg:grid-cols-12'>
        <div className='lg:col-span-5'>
          <HabitsCard habits={views} showLink={false} />
        </div>
        <div className='flex flex-col gap-5 lg:col-span-7'>
          {active.length === 0 && <EmptyNote>Add a habit to start tracking.</EmptyNote>}
          {active.map((habit) => {
            const days = new Set(logsBy.get(habit.id) ?? []);
            const rate30 = [...days].filter((d) => d >= last30).length / 30;
            return (
              <SectionCard
                key={habit.id}
                title={habit.name}
                eyebrow={`${habit.targetPerWeek} days a week`}
                action={
                  <RowActions
                    entity='life.habits'
                    id={habit.id}
                    label={habit.name}
                    fields={FORMS.habit}
                    values={habit}
                  />
                }
              >
                <div className='flex flex-wrap items-end gap-6'>
                  <div
                    className='grid grid-flow-col grid-rows-7 gap-1'
                    role='img'
                    aria-label={`${habit.name}: last ${WEEKS} weeks, ${days.size} check-ins`}
                  >
                    {gridDays.map((d) => (
                      <span
                        key={d}
                        title={d}
                        className={cn(
                          'size-3 rounded-[3px] md:size-3.5',
                          days.has(d) ? 'bg-rose' : 'bg-blush/70',
                          d === today && 'ring-champagne ring-2'
                        )}
                      />
                    ))}
                  </div>
                  <dl className='grid grid-cols-3 gap-4 text-center sm:gap-6'>
                    {[
                      ['Current', `${views.find((v) => v.id === habit.id)?.streak ?? 0}d`],
                      ['Best', `${bestStreak([...days])}d`],
                      ['30-day', `${Math.round(rate30 * 100)}%`]
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dd className='font-display text-2xl leading-none'>{value}</dd>
                        <dt className='text-muted-foreground mt-1 text-[0.65rem] tracking-[0.12em] uppercase'>
                          {label}
                        </dt>
                      </div>
                    ))}
                  </dl>
                </div>
              </SectionCard>
            );
          })}
          {archived.length > 0 && (
            <SectionCard title='Archived' eyebrow='Resting'>
              <ul className='space-y-1'>
                {archived.map((h) => (
                  <li key={h.id} className='flex items-center justify-between text-sm'>
                    <span className='text-muted-foreground'>{h.name}</span>
                    <RowActions
                      entity='life.habits'
                      id={h.id}
                      label={h.name}
                      fields={FORMS.habit}
                      values={h}
                      extra={[{ label: 'Restore', patch: { archived: false } }]}
                    />
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
