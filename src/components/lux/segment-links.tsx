import Link from 'next/link';

import { cn } from '@/lib/utils';

/** Pill tabs that keep the choice in the URL, so views are linkable and work without JS. */
export function SegmentLinks({
  items,
  current,
  label
}: {
  items: { value: string; label: string; href: string; count?: number }[];
  current: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className='bg-muted/70 inline-flex rounded-full p-1'>
      {items.map((item) => {
        const active = item.value === current;
        return (
          <Link
            key={item.value}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm transition-colors',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className='text-muted-foreground ml-1.5 text-xs tabular-nums'>
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
