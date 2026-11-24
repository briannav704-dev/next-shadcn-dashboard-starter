'use client';

import { useOptimistic, useTransition } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { adjustStockAction } from '../server/actions';

export function StockStepper({
  itemId,
  name,
  onHand,
  unit
}: {
  itemId: string;
  name: string;
  onHand: number;
  unit: string;
}) {
  const [optimistic, add] = useOptimistic(onHand, (n, delta: number) => Math.max(0, n + delta));
  const [, startTransition] = useTransition();

  function change(delta: number) {
    startTransition(async () => {
      add(delta);
      const result = await adjustStockAction({ itemId, delta });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className='flex items-center gap-1'>
      <Button
        variant='outline'
        size='icon-sm'
        className='rounded-full'
        aria-label={`Use one ${unit} of ${name}`}
        disabled={optimistic <= 0}
        onClick={() => change(-1)}
      >
        <Icons.minus />
      </Button>
      <span className='w-14 text-center text-sm tabular-nums' aria-live='polite'>
        {Number.isInteger(optimistic) ? optimistic : optimistic.toFixed(1)}{' '}
        <span className='text-muted-foreground text-xs'>{unit}</span>
      </span>
      <Button
        variant='outline'
        size='icon-sm'
        className='rounded-full'
        aria-label={`Add one ${unit} of ${name}`}
        onClick={() => change(1)}
      >
        <Icons.add />
      </Button>
    </div>
  );
}
