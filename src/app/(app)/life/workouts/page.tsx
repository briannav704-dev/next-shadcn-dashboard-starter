import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { FORMS, WEEKDAY_LABEL, WORKOUT_KIND_LABEL } from '@/features/life/forms';
import { isoWeekday } from '@/features/life/lib/modules';
import { todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Workout plan' };

export default async function WorkoutsPage() {
  const { repos, profile } = await requireOwnerPage();
  const today = todayKey(profile.timezone);
  const todayWeekday = isoWeekday(today);
  const plans = await repos.entities('life.workout_plans').list({ order: [{ field: 'weekday' }] });

  return (
    <PageContainer
      eyebrow='My Life · Wellness'
      pageTitle='Workout plan'
      pageDescription='Your weekly rhythm. Log any session with one tap.'
      pageHeaderAction={
        <AddButton
          entity='life.workout_plans'
          label='Add session'
          title='Plan a session'
          fields={FORMS.workoutPlan}
          initial={{ weekday: String(todayWeekday), kind: 'strength', durationMinutes: 45 }}
        />
      }
    >
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {(Object.entries(WEEKDAY_LABEL) as [string, string][]).map(([num, name]) => {
          const day = plans.filter((p) => p.weekday === Number(num));
          const isToday = Number(num) === todayWeekday;
          return (
            <section
              key={num}
              aria-label={name}
              className={cn(
                'lux-card flex flex-col p-4',
                isToday && 'border-champagne/70 bg-blush/30'
              )}
            >
              <div className='flex items-baseline justify-between'>
                <h2 className='font-display text-xl'>{name}</h2>
                {isToday && (
                  <span className='text-rose text-[0.65rem] font-medium tracking-[0.2em] uppercase'>
                    Today
                  </span>
                )}
              </div>
              <div className='gold-rule my-3' />
              {day.length === 0 ? (
                <p className='text-muted-foreground text-sm italic'>Rest & restore</p>
              ) : (
                <ul className='space-y-4'>
                  {day.map((p) => (
                    <li key={p.id}>
                      <div className='flex items-start justify-between gap-2'>
                        <div>
                          <p className='text-sm font-medium'>{p.title}</p>
                          <p className='text-muted-foreground text-xs'>
                            {WORKOUT_KIND_LABEL[p.kind]} · {p.durationMinutes} min
                          </p>
                        </div>
                        <RowActions
                          entity='life.workout_plans'
                          id={p.id}
                          label={p.title}
                          fields={FORMS.workoutPlan}
                          values={{ ...p, weekday: String(p.weekday) }}
                        />
                      </div>
                      {p.exercises && (
                        <ul className='text-muted-foreground mt-2 space-y-0.5 text-xs'>
                          {p.exercises
                            .split('\n')
                            .filter(Boolean)
                            .map((ex) => (
                              <li key={ex}>· {ex}</li>
                            ))}
                        </ul>
                      )}
                      <AddButton
                        entity='life.workout_logs'
                        variant='ghost'
                        label='Log it'
                        title={`Log ${p.title}`}
                        fields={FORMS.workoutLog}
                        initial={{
                          title: p.title,
                          kind: p.kind,
                          durationMinutes: p.durationMinutes,
                          performedOn: today,
                          intensity: 'moderate',
                          notes: p.exercises
                        }}
                        className='text-primary -ml-2 mt-1 h-8 px-2 text-xs'
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </PageContainer>
  );
}
