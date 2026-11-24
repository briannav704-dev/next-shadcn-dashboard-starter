import type * as React from 'react';

import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  icon,
  delta,
  hint,
  className
}: {
  label: string;
  value: string;
  icon?: keyof typeof Icons;
  /** Percent change; positive renders as an increase. null means "no comparison yet". */
  delta?: number | null;
  hint?: React.ReactNode;
  className?: string;
}) {
  const Icon = icon ? Icons[icon] : null;
  const showDelta = delta !== undefined && delta !== null && Number.isFinite(delta);
  const up = showDelta && delta >= 0;
  return (
    <div
      className={cn(
        'lux-card lux-card-interactive flex min-w-0 flex-col gap-2.5 p-4 md:gap-3 md:p-5',
        className
      )}
    >
      <div className='flex items-center justify-between gap-2'>
        <p className='text-muted-foreground text-[0.65rem] leading-tight font-medium tracking-[0.1em] uppercase md:text-xs md:tracking-[0.14em]'>
          {label}
        </p>
        {Icon && (
          <span className='bg-blush text-rose hidden size-8 shrink-0 place-items-center rounded-full sm:grid'>
            <Icon className='size-4' aria-hidden />
          </span>
        )}
      </div>
      <p className='font-display text-[1.65rem] leading-none font-medium md:text-[2rem]'>{value}</p>
      <div className='text-muted-foreground flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] md:text-xs'>
        {showDelta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium',
              up ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
            )}
          >
            {up ? (
              <Icons.trendingUp className='size-3' aria-hidden />
            ) : (
              <Icons.trendingDown className='size-3' aria-hidden />
            )}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {hint}
      </div>
    </div>
  );
}
