import Link from 'next/link';

import { Icons } from '@/components/icons';

/** Prev / label / next navigation that keeps state in the URL. */
export function Pager({
  label,
  prevHref,
  nextHref,
  todayHref,
  isCurrent
}: {
  label: string;
  prevHref: string;
  nextHref: string;
  todayHref?: string;
  isCurrent?: boolean;
}) {
  const btn =
    'border-border hover:border-champagne/60 hover:bg-card grid size-9 place-items-center rounded-full border transition-colors';
  return (
    <div className='flex items-center gap-2'>
      <Link href={prevHref} className={btn} aria-label='Previous'>
        <Icons.chevronLeft className='size-4' />
      </Link>
      <span className='font-display min-w-36 text-center text-lg'>{label}</span>
      <Link href={nextHref} className={btn} aria-label='Next'>
        <Icons.chevronRight className='size-4' />
      </Link>
      {todayHref && !isCurrent && (
        <Link
          href={todayHref}
          className='text-primary ml-1 rounded-full px-3 py-1.5 text-xs font-medium hover:underline'
        >
          Today
        </Link>
      )}
    </div>
  );
}
