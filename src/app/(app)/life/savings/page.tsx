import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { ProgressRing } from '@/components/lux/progress-ring';
import { SectionCard } from '@/components/lux/section-card';
import { FORMS } from '@/features/life/forms';
import { savingsProgress } from '@/features/life/lib/modules';
import { todayKey } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Savings goals' };

const fmtDay = (key: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${key}T12:00:00Z`));

export default async function SavingsPage() {
  const { repos, profile } = await requireOwnerPage();
  const today = todayKey(profile.timezone);
  const [goals, contributions] = await Promise.all([
    repos.entities('life.savings_goals').list({ order: [{ field: 'targetDate' }] }),
    repos
      .entities('life.savings_contributions')
      .list({ order: [{ field: 'contributedOn', ascending: false }] })
  ]);
  const totalSaved = contributions.reduce((s, c) => s + c.amountCents, 0);
  const goalName = new Map(goals.map((g) => [g.id, g.name]));

  return (
    <PageContainer
      eyebrow='My Life · Money'
      pageTitle='Savings goals'
      pageDescription={`${formatCents(totalSaved, { whole: true })} saved across ${goals.length} goals`}
      pageHeaderAction={
        <AddButton
          entity='life.savings_goals'
          label='New goal'
          title='New savings goal'
          fields={FORMS.savingsGoal}
          initial={{ status: 'active' }}
        />
      }
    >
      {goals.length === 0 && (
        <EmptyNote>Create a goal (a trip, a car, an emergency fund) and watch it fill.</EmptyNote>
      )}
      <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
        {goals.map((goal) => {
          const p = savingsProgress(goal, contributions, today);
          return (
            <section
              key={goal.id}
              className='lux-card lux-card-interactive flex flex-col p-5'
              aria-label={goal.name}
            >
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <p className='text-gold-ink text-[0.65rem] font-medium tracking-[0.2em] uppercase'>
                    {goal.status === 'active'
                      ? goal.targetDate
                        ? `By ${fmtDay(goal.targetDate)}`
                        : 'No deadline'
                      : goal.status}
                  </p>
                  <h2 className='font-display mt-1 text-2xl leading-tight'>{goal.name}</h2>
                </div>
                <RowActions
                  entity='life.savings_goals'
                  id={goal.id}
                  label={goal.name}
                  fields={FORMS.savingsGoal}
                  values={goal}
                  extra={
                    p.remainingCents === 0 && goal.status !== 'achieved'
                      ? [
                          {
                            label: 'Mark achieved',
                            icon: 'badgeCheck',
                            patch: { status: 'achieved' }
                          }
                        ]
                      : undefined
                  }
                />
              </div>
              <div className='mt-4 flex items-center gap-5'>
                <ProgressRing value={p.progress} size={92} />
                <div className='min-w-0'>
                  <p className='font-display text-3xl leading-none'>
                    {formatCents(p.savedCents, { whole: true })}
                  </p>
                  <p className='text-muted-foreground mt-1 text-xs'>
                    of {formatCents(goal.targetCents, { whole: true })}
                  </p>
                  {p.monthlyNeededCents !== null && (
                    <p className='text-rose mt-2 text-xs font-medium'>
                      {formatCents(p.monthlyNeededCents, { whole: true })}/month to stay on track
                    </p>
                  )}
                  {p.overdue && (
                    <p className='text-destructive mt-2 text-xs'>Past the target date</p>
                  )}
                  {p.remainingCents === 0 && (
                    <p className='text-success mt-2 text-xs font-medium'>Fully funded ✨</p>
                  )}
                </div>
              </div>
              <div className='mt-5'>
                <AddButton
                  entity='life.savings_contributions'
                  variant='outline'
                  label='Add money'
                  title={`Add to ${goal.name}`}
                  fields={FORMS.contribution}
                  initial={{ contributedOn: today }}
                  fixed={{ goalId: goal.id }}
                  className='w-full'
                />
              </div>
            </section>
          );
        })}
      </div>

      <SectionCard title='Recent activity' eyebrow='Deposits & withdrawals' className='mt-5'>
        {contributions.length === 0 ? (
          <EmptyNote>No deposits yet.</EmptyNote>
        ) : (
          <ul className='divide-border/60 divide-y'>
            {contributions.slice(0, 15).map((c) => (
              <li key={c.id} className='flex items-center gap-3 py-2.5'>
                <span className='text-muted-foreground w-24 shrink-0 text-xs'>
                  {fmtDay(c.contributedOn)}
                </span>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm'>{goalName.get(c.goalId)}</p>
                  {c.note && <p className='text-muted-foreground truncate text-xs'>{c.note}</p>}
                </div>
                <span
                  className={
                    c.amountCents < 0
                      ? 'text-destructive text-sm tabular-nums'
                      : 'text-success text-sm tabular-nums'
                  }
                >
                  {c.amountCents < 0 ? '−' : '+'}
                  {formatCents(Math.abs(c.amountCents))}
                </span>
                <RowActions
                  entity='life.savings_contributions'
                  id={c.id}
                  label='this deposit'
                  fields={FORMS.contribution}
                  values={c}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageContainer>
  );
}
