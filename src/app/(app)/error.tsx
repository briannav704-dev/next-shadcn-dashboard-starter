'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className='grid flex-1 place-items-center px-4 py-16'>
      <div className='lux-card max-w-md p-8 text-center'>
        <span className='bg-blush text-rose mx-auto grid size-12 place-items-center rounded-full'>
          <Icons.alertCircle className='size-6' aria-hidden />
        </span>
        <h1 className='font-display mt-4 text-2xl font-medium'>This page didn’t load</h1>
        <p className='text-muted-foreground mt-2 text-sm'>
          Nothing was lost. It may be a brief connection issue. Try again, and if it keeps happening
          the error has been recorded{error.digest ? ` (ref ${error.digest})` : ''}.
        </p>
        <Button className='mt-6 rounded-full px-5' onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
