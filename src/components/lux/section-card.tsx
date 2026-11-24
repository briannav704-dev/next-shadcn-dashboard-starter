import type * as React from 'react';

import { cn } from '@/lib/utils';

export function SectionCard({
  title,
  eyebrow,
  action,
  children,
  className,
  bodyClassName
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('lux-card flex min-w-0 flex-col', className)} aria-label={title}>
      <header className='flex items-start justify-between gap-3 px-5 pt-5'>
        <div className='min-w-0'>
          {eyebrow && (
            <p className='text-gold-ink text-[0.65rem] font-medium tracking-[0.22em] uppercase'>
              {eyebrow}
            </p>
          )}
          <h2 className='font-display mt-0.5 text-xl font-medium'>{title}</h2>
        </div>
        {action && <div className='shrink-0'>{action}</div>}
      </header>
      <div className='gold-rule mx-5 mt-3' />
      <div className={cn('flex-1 px-5 pt-4 pb-5', bodyClassName)}>{children}</div>
    </section>
  );
}
