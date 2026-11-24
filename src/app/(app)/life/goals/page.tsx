import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { FORMS, GOAL_AREA_LABEL } from '@/features/life/forms';
import { daysFrom } from '@/features/life/lib/modules';
import { goalProgress } from '@/features/life/lib/summary';
import { todayKey } from '@/lib/dates';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Goals' };

function fmt(value: number, unit: string | null) {
  if (unit === '$') return `$${value.toLocaleString('en-US')}`;
  return `${value.toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`;
}

export default async function GoalsPage() {
  const { repos, profile } = await requireOwnerPage();
  const today = todayKey(profile.timezone);
  const goals = await repos.entities('life.goals').list({ order: [{ field: 'targetDate' }] });
  const active = goals.filter((g) => g.status === 'active');
  const other = goals.filter((g) => g.status !== 'active');

  return (
    <PageContainer
      eyebrow='My Life'
      pageTitle='Goals'
      pageDescription='Who you are becoming, one step at a time.'
      pageHeaderAction={
        <AddButton
          entity='life.goals'
          label='New goal'
          title='New goal'
          fields={FORMS.goal}
          initial={{ area: 'personal', status: 'active', currentValue: 0 }}
        />
      }
    >
      {active.length === 0 && <EmptyNote>Set a goal and track every step toward it.</EmptyNote>}
      <div className='grid gap-5 md:grid-cols-2'>
        {active.map((g) => {
          const pct = goalProgress(g);
          const daysLeft = g.targetDate ? daysFrom(today, g.targetDate) : null;
          const step =
            g.targetValue <= 50 ? 1 : g.unit === '$' ? 100 : Math.ceil(g.targetValue / 50);
          return (
            <section key={g.id} className='lux-card p-5' aria-label={g.title}>
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <p className='text-gold-ink text-[0.65rem] font-medium tracking-[0.2em] uppercase'>
                    {GOAL_AREA_LABEL[g.area]}
                  </p>
                  <h2 className='font-display mt-1 text-2xl leading-tight'>{g.title}</h2>
                </div>
                <RowActions
                  entity='life.goals'
                  id={g.id}
                  label={g.title}
                  fields={FORMS.goal}
                  values={g}
                  extra={[
                    {
                      label: `Add ${fmt(step, g.unit)}`,
                      icon: 'add',
                      patch: { currentValue: Math.min(g.targetValue, g.currentValue + step) }
                    },
                    {
                      label: 'Mark achieved',
                      icon: 'badgeCheck',
                      patch: { status: 'achieved', currentValue: g.targetValue }
                    }
                  ]}
                />
              </div>
              <div className='mt-4 flex items-baseline justify-between'>
                <p className='font-display text-rose text-4xl leading-none'>
                  {Math.round(pct * 100)}%
                </p>
                <p className='text-muted-foreground text-xs'>
                  {fmt(g.currentValue, g.unit)} of {fmt(g.targetValue, g.unit)}
                </p>
              </div>
              <div
                className='bg-blush mt-3 h-2 overflow-hidden rounded-full'
                role='progressbar'
                aria-label={g.title}
                aria-valuenow={Math.round(pct * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className='from-rose to-champagne h-full rounded-full bg-linear-to-r'
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
              {daysLeft !== null && (
                <p
                  className={
                    daysLeft < 0
                      ? 'text-destructive mt-2 text-xs'
                      : 'text-muted-foreground mt-2 text-xs'
                  }
                >
                  {daysLeft < 0 ? `${-daysLeft} days past target` : `${daysLeft} days to go`}
                </p>
              )}
            </section>
          );
        })}
      </div>
      {other.length > 0 && (
        <SectionCard title='Achieved & paused' eyebrow='Archive' className='mt-5'>
          <ul className='divide-border/60 divide-y'>
            {other.map((g) => (
              <li key={g.id} className='flex items-center gap-3 py-2'>
                <span
                  className={
                    g.status === 'achieved'
                      ? 'text-success text-xs'
                      : 'text-muted-foreground text-xs'
                  }
                >
                  {g.status === 'achieved' ? '✓ Achieved' : 'Paused'}
                </span>
                <span className='min-w-0 flex-1 truncate text-sm'>{g.title}</span>
                <RowActions
                  entity='life.goals'
                  id={g.id}
                  label={g.title}
                  fields={FORMS.goal}
                  values={g}
                  extra={[{ label: 'Make active', patch: { status: 'active' } }]}
                />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </PageContainer>
  );
}
