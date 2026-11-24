'use client';

import Link from 'next/link';
import { useEffect, useRef, useTransition } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/dates';
import { cn } from '@/lib/utils';

import { syncNailzyAction } from '../server/actions';

const STALE_MS = 30 * 60_000;

type LastRun = {
  ranAt: string;
  ok: boolean;
  added: number;
  updated: number;
  cancelled: number;
  message: string | null;
};

function describe(run: LastRun) {
  if (!run.ok) return run.message ?? 'The last sync failed.';
  const parts = [
    run.added && `${run.added} new`,
    run.updated && `${run.updated} changed`,
    run.cancelled && `${run.cancelled} cancelled`
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Everything was already up to date.';
}

/** Nailzy calendar status, with a "Sync now" button; syncs itself when stale. */
export function SyncCard({
  source,
  lastRun,
  timeZone
}: {
  source: 'live' | 'sample' | null;
  lastRun: LastRun | null;
  timeZone: string;
}) {
  const [pending, startTransition] = useTransition();
  const autoRan = useRef(false);

  function sync(quiet = false) {
    startTransition(async () => {
      const result = await syncNailzyAction();
      if (!result.ok) {
        if (!quiet) toast.error(result.error);
        return;
      }
      const { added, updated, cancelled } = result.data;
      if (!quiet || added + updated + cancelled > 0) {
        toast.success(
          added + updated + cancelled > 0
            ? `Nailzy synced: ${added} new, ${updated} changed, ${cancelled} cancelled`
            : 'Nailzy bookings are up to date'
        );
      }
    });
  }

  useEffect(() => {
    if (!source || autoRan.current) return;
    if (lastRun && Date.now() - Date.parse(lastRun.ranAt) < STALE_MS) return;
    autoRan.current = true;
    sync(true);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per visit, only when stale
  }, []);

  if (!source) {
    return (
      <div className='lux-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center'>
        <span className='bg-blush text-rose grid size-10 shrink-0 place-items-center rounded-full'>
          <Icons.calendarEvent className='size-5' aria-hidden />
        </span>
        <div className='min-w-0 flex-1'>
          <p className='font-medium'>Connect your Nailzy calendar</p>
          <p className='text-muted-foreground text-sm'>
            Bookings will appear here automatically. It takes about five minutes on your iPad.
          </p>
        </div>
        <Link
          href='/kouture/appointments/connect'
          className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 shrink-0 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors'
        >
          Show me how
        </Link>
      </div>
    );
  }

  return (
    <div className='lux-card flex flex-wrap items-center gap-3 p-4 md:px-5'>
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          lastRun && !lastRun.ok ? 'bg-destructive/10 text-destructive' : 'bg-blush text-rose'
        )}
      >
        {lastRun && !lastRun.ok ? (
          <Icons.warning className='size-4' aria-hidden />
        ) : (
          <Icons.calendarEvent className='size-4' aria-hidden />
        )}
      </span>
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-medium'>
          Nailzy calendar{source === 'sample' && ' · sample bookings'}
        </p>
        <p className='text-muted-foreground text-xs' aria-live='polite'>
          {pending
            ? 'Syncing…'
            : lastRun
              ? `Last synced ${formatTime(lastRun.ranAt, timeZone)} — ${describe(lastRun)}`
              : 'Not synced yet'}
        </p>
      </div>
      <Button
        variant='outline'
        size='lg'
        className='rounded-full'
        onClick={() => sync()}
        disabled={pending}
      >
        <Icons.switch className={cn(pending && 'animate-spin')} />
        Sync now
      </Button>
    </div>
  );
}
