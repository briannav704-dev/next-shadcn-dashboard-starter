'use client';

import Link from 'next/link';
import { useOptimistic, useTransition } from 'react';
import { toast } from 'sonner';

import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { Icons } from '@/components/icons';
import { relativeDayLabel } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { Task } from '@/server/data/types';

import { toggleTaskAction } from '../server/actions';

const PRIORITY_DOT: Record<Task['priority'], string> = {
  high: 'bg-rose',
  normal: 'bg-champagne',
  low: 'bg-taupe/50'
};

export function TasksCard({ tasks, today }: { tasks: Task[]; today: string }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    tasks,
    (state, update: { id: string; done: boolean }) =>
      state.map((t): Task =>
        t.id === update.id ? { ...t, status: update.done ? 'done' : 'open' } : t
      )
  );

  function toggle(task: Task) {
    const done = task.status !== 'done';
    startTransition(async () => {
      setOptimistic({ id: task.id, done });
      const result = await toggleTaskAction({ taskId: task.id, done });
      if (!result.ok) toast.error(result.error);
    });
  }

  const openCount = optimistic.filter((t) => t.status === 'open').length;

  return (
    <SectionCard
      title='Tasks'
      eyebrow='To do'
      action={
        <Link href='/life/tasks' className='text-primary text-xs font-medium hover:underline'>
          {openCount} open · View all
        </Link>
      }
    >
      {optimistic.length === 0 ? (
        <EmptyNote>Nothing on your list. Beautiful.</EmptyNote>
      ) : (
        <ul className='-mx-1 space-y-0.5' aria-busy={pending}>
          {optimistic.map((task) => {
            const done = task.status === 'done';
            const label = task.dueOn ? relativeDayLabel(task.dueOn, today) : null;
            return (
              <li key={task.id}>
                <button
                  type='button'
                  onClick={() => toggle(task)}
                  aria-pressed={done}
                  className='hover:bg-muted/70 focus-visible:ring-ring/60 group flex w-full items-center gap-3 rounded-lg px-1.5 py-2 text-left outline-none focus-visible:ring-2'
                >
                  <span
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
                      done
                        ? 'border-rose bg-rose text-primary-foreground'
                        : 'border-input group-hover:border-rose/60'
                    )}
                    aria-hidden
                  >
                    {done && <Icons.check className='size-3' />}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-sm',
                      done && 'text-muted-foreground line-through'
                    )}
                  >
                    {task.title}
                  </span>
                  {label && (
                    <span
                      className={cn(
                        'shrink-0 text-xs tabular-nums',
                        label === 'Overdue'
                          ? 'text-destructive'
                          : label === 'Today'
                            ? 'text-rose'
                            : 'text-muted-foreground'
                      )}
                    >
                      {label}
                    </span>
                  )}
                  <span
                    className={cn('size-1.5 shrink-0 rounded-full', PRIORITY_DOT[task.priority])}
                    aria-label={`${task.priority} priority`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
