import { cn } from '@/lib/utils';

/** Champagne-ringed "K" monogram used as the app mark. */
export function Monogram({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 40 40' aria-hidden='true' className={cn('size-9', className)}>
      <defs>
        <linearGradient id='kouture-gold' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stopColor='var(--champagne)' />
          <stop offset='55%' stopColor='color-mix(in oklch, var(--champagne) 70%, white)' />
          <stop offset='100%' stopColor='var(--gold-ink)' />
        </linearGradient>
      </defs>
      <circle
        cx='20'
        cy='20'
        r='18.5'
        fill='var(--blush)'
        stroke='url(#kouture-gold)'
        strokeWidth='1.5'
      />
      <circle
        cx='20'
        cy='20'
        r='15.5'
        fill='none'
        stroke='url(#kouture-gold)'
        strokeWidth='0.5'
        opacity='0.7'
      />
      <text
        x='20'
        y='26.5'
        textAnchor='middle'
        fontFamily='var(--font-display)'
        fontSize='19'
        fontWeight='500'
        fill='var(--rose)'
      >
        K
      </text>
    </svg>
  );
}

export function Wordmark({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col leading-none', className)}>
      <span className='font-display truncate text-[1.15rem] font-medium tracking-[0.08em] uppercase'>
        Kouture
      </span>
      <span className='text-gold-ink mt-1 truncate text-[0.62rem] font-medium tracking-[0.28em] uppercase'>
        {subtitle ?? 'Life OS'}
      </span>
    </div>
  );
}
