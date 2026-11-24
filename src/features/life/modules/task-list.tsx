'use client';

import { useOptimistic, useTransition } from 'react';
import { toast } from 'sonner';

import { RowActions } from '@/components/entity/entity-controls';
import { EmptyNote } from '@/components/lux/empty-note';
import { Icons } from '@/components/icons';
import { relativeDayLabel } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { RowOf } from '@/server/entities/definitions';

import { FORMS } from '../forms';
import { toggleTaskAction } from '../server/actions';

type Task = RowOf<'life.tasks'>;

const PRIORITY_DOT = { high: 'bg-rose', normal: 'bg-champagne', low: 'bg-taupe/50' } as const;

export function TaskList({ tasks, today, empty }: { tasks: Task[]; today: string; empty: string }) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    tasks,
    (state, u: { id: string; done: boolean }) =>
      state.map((t): Task => (t.id === u.id ? { ...t, status: u.done ? 'done' : 'open' } : t))
  );

  if (optimistic.length === 0) return <EmptyNote>{empty}</EmptyNote>;

  return (
    <ul className='divide-border/60 divide-y'>
      {optimistic.map((task) => {
        const done = task.status === 'done';
        const label = task.dueOn ? relativeDayLabel(task.dueOn, today) : null;
        return (
          <li key={task.id} className='flex items-center gap-3 py-2.5'>
            <button
              type='button'
              aria-pressed={done}
              aria-label={`${done ? 'Reopen' : 'Complete'} ${task.title}`}
              onClick={() =>
                startTransition(async () => {
                  setOptimistic({ id: task.id, done: !done });
                  const result = await toggleTaskAction({ taskId: task.id, done: !done });
                  if (!result.ok) toast.error(result.error);
                })
              }
              className={cn(
                'focus-visible:ring-ring/60 grid size-6 shrink-0 place-items-center rounded-full border outline-none transition-colors focus-visible:ring-2',
                done
                  ? 'border-rose bg-rose text-primary-foreground'
                  : 'border-input hover:border-rose/60'
              )}
            >
              {done && <Icons.check className='size-3.5' />}
            </button>
            <div className='min-w-0 flex-1'>
              <p className={cn('truncate text-sm', done && 'text-muted-foreground line-through')}>
                {task.title}
              </p>
              {task.notes && <p className='text-muted-foreground truncate text-xs'>{task.notes}</p>}
            </div>
            {label && (
              <span
                className={cn(
                  'shrink-0 text-xs',
                  label === 'Overdue' && !done
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
            <RowActions
              entity='life.tasks'
              id={task.id}
              label={task.title}
              fields={FORMS.task}
              values={task}
            />
          </li>
        );
      })}
    </ul>
  );
}
