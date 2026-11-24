import type { Metadata } from 'next';
import Link from 'next/link';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { Pager } from '@/components/lux/pager';
import { SectionCard } from '@/components/lux/section-card';
import { FORMS, MEAL_SLOT_LABEL, WORKOUT_KIND_LABEL } from '@/features/life/forms';
import { isoWeekday, sortRoutines } from '@/features/life/lib/modules';
import { TaskList } from '@/features/life/modules/task-list';
import { addDays, formatDayLong, formatTime, startOfDayInZone, todayKey } from '@/lib/dates';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Daily planner' };

type PageProps = { searchParams: Promise<{ day?: string }> };

export default async function PlannerPage({ searchParams }: PageProps) {
  const { repos, profile } = await requireOwnerPage();
  const tz = profile.timezone;
  const today = todayKey(tz);
  const { day: raw } = await searchParams;
  const day = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
  const from = startOfDayInZone(day, tz).toISOString();
  const to = startOfDayInZone(addDays(day, 1), tz).toISOString();
  const e = repos.entities;

  const [plans, events, tasks, overdue, meals, workouts, routines, salon] = await Promise.all([
    e('life.day_plans').list({ eq: { day } }),
    e('life.events').list({
      range: { field: 'startsAt', gte: from, lt: to },
      order: [{ field: 'startsAt' }]
    }),
    e('life.tasks').list({ eq: { dueOn: day } }),
    day === today
      ? e('life.tasks').list({ eq: { status: 'open' }, range: { field: 'dueOn', lt: today } })
      : Promise.resolve([]),
    e('life.meals').list({ eq: { day } }),
    e('life.workout_plans').list({ eq: { weekday: isoWeekday(day) } }),
    e('life.selfcare_routines').list({ eq: { archived: false } }),
    // Only times and a count cross over from the salon, never client details.
    repos.kouture.listAppointments({ from, to })
  ]);
  const plan = plans[0];
  const salonDay = salon.filter((a) => a.status !== 'cancelled');
  const dueCare = sortRoutines(routines, day).filter((r) => r.daysUntil <= 0);
  const slotOrder = ['breakfast', 'lunch', 'dinner', 'snack'];
  const sortedMeals = meals.toSorted(
    (a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot)
  );

  return (
    <PageContainer
      eyebrow='My Life'
      pageTitle='Daily planner'
      pageDescription={formatDayLong(day)}
      pageHeaderAction={
        <Pager
          label={day === today ? 'Today' : formatDayLong(day).split(',')[0]}
          prevHref={`/life/planner?day=${addDays(day, -1)}`}
          nextHref={`/life/planner?day=${addDays(day, 1)}`}
          todayHref='/life/planner'
          isCurrent={day === today}
        />
      }
    >
      <div className='grid gap-5 lg:grid-cols-12'>
        <section className='lux-card hero-wash p-6 md:p-8 lg:col-span-12' aria-label='Intention'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div className='min-w-0 flex-1'>
              <p className='text-gold-ink text-xs font-medium tracking-[0.22em] uppercase'>
                Intention
              </p>
              <p className='font-display mt-2 text-3xl text-balance md:text-4xl'>
                {plan?.intention ? (
                  <em className='text-rose'>{plan.intention}</em>
                ) : (
                  'Set the tone for your day'
                )}
              </p>
            </div>
            <AddButton
              entity='life.day_plans'
              mode='upsert'
              variant='outline'
              label={plan ? 'Edit plan' : 'Plan this day'}
              title={`Plan for ${formatDayLong(day)}`}
              fields={FORMS.dayPlan}
              initial={plan ?? {}}
              fixed={{ day }}
            />
          </div>
          <ol className='mt-6 grid gap-3 sm:grid-cols-3'>
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className='bg-card/70 flex items-start gap-3 rounded-xl border p-4 backdrop-blur'
              >
                <span className='font-display text-rose text-2xl leading-none'>{i + 1}</span>
                <span className={plan?.priorities[i] ? 'text-sm' : 'text-muted-foreground text-sm'}>
                  {plan?.priorities[i] ?? 'Top priority'}
                </span>
              </li>
            ))}
          </ol>
          {plan?.notes && (
            <p className='text-muted-foreground mt-4 text-sm whitespace-pre-line'>{plan.notes}</p>
          )}
        </section>

        <div className='lg:col-span-7'>
          <SectionCard
            title='Schedule'
            eyebrow='Time'
            action={
              <AddButton
                entity='life.events'
                variant='ghost'
                label='Add'
                title='New event'
                fields={FORMS.event}
                initial={{
                  startsAt: new Date(Date.parse(from) + 9 * 3_600_000).toISOString(),
                  endsAt: new Date(Date.parse(from) + 10 * 3_600_000).toISOString(),
                  category: 'personal'
                }}
              />
            }
          >
            <ul className='space-y-2'>
              {salonDay.length > 0 && (
                <li className='bg-blush/50 flex items-center gap-3 rounded-xl px-3 py-2.5'>
                  <span className='bg-rose h-9 w-1 rounded-full' aria-hidden />
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium'>
                      At the salon · {salonDay.length}{' '}
                      {salonDay.length === 1 ? 'client' : 'clients'}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {formatTime(salonDay[0].startsAt, tz)} –{' '}
                      {formatTime(salonDay.at(-1)!.endsAt, tz)}
                    </p>
                  </div>
                  <Link
                    href='/kouture'
                    className='text-primary text-xs font-medium hover:underline'
                  >
                    Kouture
                  </Link>
                </li>
              )}
              {events.map((ev) => (
                <li key={ev.id} className='flex items-center gap-3 px-1 py-1.5'>
                  <span className='w-16 shrink-0 text-right text-xs tabular-nums'>
                    {formatTime(ev.startsAt, tz)}
                  </span>
                  <span className='bg-champagne h-9 w-px shrink-0' aria-hidden />
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>{ev.title}</p>
                    <p className='text-muted-foreground truncate text-xs'>
                      until {formatTime(ev.endsAt, tz)}
                      {ev.location ? ` · ${ev.location}` : ''}
                    </p>
                  </div>
                  <RowActions
                    entity='life.events'
                    id={ev.id}
                    label={ev.title}
                    fields={FORMS.event}
                    values={ev}
                  />
                </li>
              ))}
              {events.length === 0 && salonDay.length === 0 && (
                <EmptyNote>Nothing scheduled. A day of possibility.</EmptyNote>
              )}
            </ul>
          </SectionCard>
        </div>

        <div className='lg:col-span-5'>
          <SectionCard
            title='To do'
            eyebrow='Tasks'
            action={
              <AddButton
                entity='life.tasks'
                variant='ghost'
                label='Add'
                title='New task'
                fields={FORMS.task}
                initial={{ dueOn: day, priority: 'normal' }}
              />
            }
          >
            <TaskList tasks={[...overdue, ...tasks]} today={today} empty='No tasks due.' />
          </SectionCard>
        </div>

        <div className='lg:col-span-4'>
          <SectionCard title='Movement' eyebrow='Workout plan'>
            {workouts.length === 0 ? (
              <EmptyNote>
                Rest day.{' '}
                <Link href='/life/workouts' className='text-primary hover:underline'>
                  Plan your week
                </Link>
              </EmptyNote>
            ) : (
              <ul className='space-y-3'>
                {workouts.map((w) => (
                  <li key={w.id}>
                    <p className='text-sm font-medium'>{w.title}</p>
                    <p className='text-muted-foreground text-xs'>
                      {WORKOUT_KIND_LABEL[w.kind]} · {w.durationMinutes} min
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
        <div className='lg:col-span-4'>
          <SectionCard title='Meals' eyebrow='Nourish'>
            {sortedMeals.length === 0 ? (
              <EmptyNote>
                No meals planned.{' '}
                <Link href='/life/meals' className='text-primary hover:underline'>
                  Plan meals
                </Link>
              </EmptyNote>
            ) : (
              <ul className='space-y-2.5'>
                {sortedMeals.map((m) => (
                  <li key={m.id} className='flex items-baseline gap-3'>
                    <span className='text-gold-ink w-20 shrink-0 text-[0.65rem] font-medium tracking-[0.14em] uppercase'>
                      {MEAL_SLOT_LABEL[m.slot]}
                    </span>
                    <span className='text-sm'>{m.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
        <div className='lg:col-span-4'>
          <SectionCard title='Self-care due' eyebrow='Beauty'>
            {dueCare.length === 0 ? (
              <EmptyNote>Nothing due. You’re glowing.</EmptyNote>
            ) : (
              <ul className='space-y-2'>
                {dueCare.slice(0, 5).map((r) => (
                  <li
                    key={r.routine.id}
                    className='flex items-center justify-between gap-3 text-sm'
                  >
                    <span>{r.routine.name}</span>
                    <span
                      className={
                        r.status === 'overdue' ? 'text-destructive text-xs' : 'text-rose text-xs'
                      }
                    >
                      {r.status === 'never'
                        ? 'Not logged yet'
                        : r.daysUntil < 0
                          ? `${-r.daysUntil}d overdue`
                          : 'Due'}
                    </span>
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
