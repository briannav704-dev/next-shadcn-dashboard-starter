'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

import { setMarketingConsentAction } from '../server/actions';
import { type ConsentState, consentLabel } from '../lib/consent';

/** Shows and records marketing consent for one channel. */
export function ConsentControl({
  clientId,
  channel,
  state,
  since
}: {
  clientId: string;
  channel: 'sms' | 'email';
  state: ConsentState;
  since: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const name = channel === 'sms' ? 'Texts' : 'Emails';

  function record(change: 'granted' | 'opted_out' | 'cleared') {
    startTransition(async () => {
      const result = await setMarketingConsentAction({ clientId, channel, change });
      if (result.ok) toast.success('Consent updated');
      else toast.error(result.error);
    });
  }

  const tone =
    state === 'subscribed'
      ? 'bg-success/12 text-success'
      : state === 'opted_out'
        ? 'bg-destructive/10 text-destructive'
        : 'bg-muted text-muted-foreground';

  return (
    <div className='flex items-center justify-between gap-3'>
      <div className='min-w-0'>
        <p className='text-sm font-medium'>Marketing {name.toLowerCase()}</p>
        <p className='text-muted-foreground text-xs'>
          <span className={`mr-1.5 inline-block rounded-full px-2 py-0.5 ${tone}`}>
            {consentLabel(state)}
          </span>
          {since &&
            new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(since))}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='sm'
              className='rounded-full'
              disabled={pending}
              aria-label={`Change ${name.toLowerCase()} consent`}
            />
          }
        >
          {pending ? <Icons.spinner className='animate-spin' /> : 'Change'}
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='min-w-56'>
          <DropdownMenuItem onClick={() => record('granted')}>
            <Icons.check />
            They agreed to marketing {name.toLowerCase()}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => record('opted_out')}>
            <Icons.circleX />
            They opted out
          </DropdownMenuItem>
          {state === 'subscribed' && (
            <DropdownMenuItem onClick={() => record('cleared')}>
              <Icons.minus />
              Clear (recorded by mistake)
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
