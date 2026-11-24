import Link from 'next/link';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import type { Goal } from '@/server/data/types';

import { goalProgress } from '../lib/summary';

function formatValue(value: number, unit: string | null) {
  if (unit === '$') return `$${value.toLocaleString('en-US')}`;
  return `${value.toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`;
}

export function GoalsCard({ goals }: { goals: Goal[] }) {
  return (
    <SectionCard
      title='Goals'
      eyebrow='Becoming'
      action={
        <Link href='/life/goals' className='text-primary text-xs font-medium hover:underline'>
          View all
        </Link>
      }
    >
      {goals.length === 0 ? (
        <EmptyNote>Set a goal and watch it fill in.</EmptyNote>
      ) : (
        <ul className='space-y-4'>
          {goals.map((goal) => {
            const pct = goalProgress(goal);
            return (
              <li key={goal.id}>
                <div className='flex items-baseline justify-between gap-3'>
                  <p className='truncate text-sm font-medium'>{goal.title}</p>
                  <p className='font-display text-rose text-lg leading-none tabular-nums'>
                    {Math.round(pct * 100)}%
                  </p>
                </div>
                <div
                  className='bg-blush mt-2 h-1.5 overflow-hidden rounded-full'
                  role='progressbar'
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(pct * 100)}
                  aria-label={goal.title}
                >
                  <div
                    className='from-rose to-champagne h-full rounded-full bg-linear-to-r transition-[width] duration-700'
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
                <p className='text-muted-foreground mt-1.5 text-xs tabular-nums'>
                  {formatValue(goal.currentValue, goal.unit)} of{' '}
                  {formatValue(goal.targetValue, goal.unit)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
