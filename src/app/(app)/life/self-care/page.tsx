import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { FORMS, SELFCARE_LABEL } from '@/features/life/forms';
import { type RoutineStatus, sortRoutines } from '@/features/life/lib/modules';
import { todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Beauty & self-care' };

const STATUS: Record<RoutineStatus, { label: (d: number) => string; className: string }> = {
  overdue: { label: (d) => `${-d} days overdue`, className: 'bg-destructive/10 text-destructive' },
  never: { label: () => 'Not logged yet', className: 'bg-muted text-muted-foreground' },
  due: { label: () => 'Due today', className: 'bg-rose text-primary-foreground' },
  soon: {
    label: (d) => `In ${d} ${d === 1 ? 'day' : 'days'}`,
    className: 'bg-blush text-secondary-foreground'
  },
  ok: { label: (d) => `In ${d} days`, className: 'bg-muted text-muted-foreground' }
};

const fmt = (key: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${key}T12:00:00Z`)
  );

export default async function SelfCarePage() {
  const { repos, profile } = await requireOwnerPage();
  const today = todayKey(profile.timezone);
  const routines = await repos.entities('life.selfcare_routines').list();
  const sorted = sortRoutines(routines, today);
  const needsLove = sorted.filter(
    (r) => r.status === 'overdue' || r.status === 'due' || r.status === 'never'
  ).length;

  return (
    <PageContainer
      eyebrow='My Life · Wellness'
      pageTitle='Beauty & self-care'
      pageDescription={
        needsLove
          ? `${needsLove} ${needsLove === 1 ? 'ritual needs' : 'rituals need'} your attention`
          : 'Everything is on schedule. You’re glowing.'
      }
      pageHeaderAction={
        <AddButton
          entity='life.selfcare_routines'
          label='New ritual'
          title='New self-care ritual'
          fields={FORMS.selfcare}
          initial={{ category: 'nails', everyDays: 14 }}
        />
      }
    >
      {sorted.length === 0 && (
        <EmptyNote>
          Add rituals like lash fills, facials or therapy, and we’ll tell you when they’re due.
        </EmptyNote>
      )}
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        {sorted.map(({ routine, nextDue, daysUntil, status }) => (
          <section
            key={routine.id}
            className='lux-card lux-card-interactive flex flex-col p-5'
            aria-label={routine.name}
          >
            <div className='flex items-start justify-between gap-2'>
              <div className='min-w-0'>
                <p className='text-gold-ink text-[0.62rem] font-medium tracking-[0.2em] uppercase'>
                  {SELFCARE_LABEL[routine.category]}
                </p>
                <h2 className='font-display mt-1 text-xl leading-tight'>{routine.name}</h2>
                {routine.provider && (
                  <p className='text-muted-foreground text-xs'>{routine.provider}</p>
                )}
              </div>
              <RowActions
                entity='life.selfcare_routines'
                id={routine.id}
                label={routine.name}
                fields={FORMS.selfcare}
                values={routine}
                extra={[{ label: 'Done today', icon: 'check', patch: { lastDoneOn: today } }]}
              />
            </div>
            <div className='mt-auto flex flex-wrap items-center justify-between gap-2 pt-4'>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium',
                  STATUS[status].className
                )}
              >
                {STATUS[status].label(daysUntil)}
              </span>
              <span className='text-muted-foreground text-xs'>
                Every {routine.everyDays} days
                {routine.lastDoneOn ? ` · last ${fmt(routine.lastDoneOn)}` : ''}
                {status !== 'never' ? ` · next ${fmt(nextDue)}` : ''}
              </span>
            </div>
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
