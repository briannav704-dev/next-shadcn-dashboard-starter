import { cn } from '@/lib/utils';

export function ProgressRing({
  value,
  size = 96,
  stroke = 7,
  label,
  className
}: {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cn('relative grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className='-rotate-90'
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill='none'
          stroke='var(--blush)'
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill='none'
          stroke='var(--rose)'
          strokeWidth={stroke}
          strokeLinecap='round'
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className='transition-[stroke-dashoffset] duration-700 ease-out'
        />
      </svg>
      <div className='absolute inset-0 grid place-items-center text-center'>
        <div>
          <p
            className='font-display leading-none font-medium'
            style={{ fontSize: Math.round(size / 4.5) }}
          >
            {Math.round(clamped * 100)}%
          </p>
          {label && (
            <p className='text-muted-foreground mt-1 text-[0.6rem] tracking-[0.14em] uppercase'>
              {label}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
