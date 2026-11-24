'use client';

import Link from 'next/link';
import { useOptimistic, useTransition } from 'react';
import { toast } from 'sonner';

import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { Icons } from '@/components/icons';
import { formatDayShort } from '@/lib/dates';
import { cn } from '@/lib/utils';

import type { HabitView } from '../lib/summary';
import { toggleHabitTodayAction } from '../server/actions';

function applyToday(habit: HabitView, done: boolean): HabitView {
  if (habit.doneToday === done) return habit;
  return {
    ...habit,
    doneToday: done,
    last7: habit.last7.map((d, i) => (i === habit.last7.length - 1 ? { ...d, done } : d)),
    streak: Math.max(0, habit.streak + (done ? 1 : -1)),
    thisWeek: Math.max(0, habit.thisWeek + (done ? 1 : -1))
  };
}

export function HabitsCard({
  habits,
  showLink = true
}: {
  habits: HabitView[];
  showLink?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    habits,
    (state, update: { id: string; done: boolean }) =>
      state.map((h) => (h.id === update.id ? applyToday(h, update.done) : h))
  );

  function toggle(habit: HabitView) {
    const done = !habit.doneToday;
    startTransition(async () => {
      setOptimistic({ id: habit.id, done });
      const result = await toggleHabitTodayAction({ habitId: habit.id, done });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <SectionCard
      title='Habits'
      eyebrow='Rituals'
      action={
        showLink && (
          <Link href='/life/habits' className='text-primary text-xs font-medium hover:underline'>
            View all
          </Link>
        )
      }
    >
      {optimistic.length === 0 ? (
        <EmptyNote>No habits yet. Add one on the Habits page.</EmptyNote>
      ) : (
        <ul className='space-y-3'>
          {optimistic.map((habit) => (
            <li key={habit.id} className='flex items-center gap-3'>
              <button
                type='button'
                onClick={() => toggle(habit)}
                aria-pressed={habit.doneToday}
                aria-label={`${habit.doneToday ? 'Undo' : 'Check in'} ${habit.name} for today`}
                className={cn(
                  'focus-visible:ring-ring/60 grid size-9 shrink-0 place-items-center rounded-full border outline-none transition-all focus-visible:ring-2 active:scale-95',
                  habit.doneToday
                    ? 'border-rose bg-rose text-primary-foreground shadow-sm'
                    : 'border-input text-muted-foreground hover:border-rose/60 hover:text-rose'
                )}
              >
                <Icons.check className='size-4' />
              </button>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>{habit.name}</p>
                <p className='text-muted-foreground text-xs tabular-nums'>
                  {habit.streak > 0 ? `${habit.streak}-day streak` : 'Start a streak today'} ·{' '}
                  {habit.thisWeek}/{habit.targetPerWeek} this week
                </p>
              </div>
              <ol className='hidden gap-1 sm:flex' aria-label='Last seven days'>
                {habit.last7.map((d) => (
                  <li
                    key={d.day}
                    title={formatDayShort(d.day)}
                    className={cn('size-2.5 rounded-full', d.done ? 'bg-rose' : 'bg-blush')}
                  >
                    <span className='sr-only'>
                      {formatDayShort(d.day)} {d.done ? 'done' : 'missed'}
                    </span>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
