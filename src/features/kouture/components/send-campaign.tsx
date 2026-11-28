'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { CopyButton } from '@/components/lux/copy-button';
import { Button } from '@/components/ui/button';

import { markCampaignSentAction } from '../server/actions';

/**
 * Sending happens in the owner's own mail app: open it with everything filled
 * in (clients in BCC), or copy the pieces. Then record it as sent.
 */
export function SendCampaign({
  campaignId,
  mailto,
  addresses,
  subject,
  text,
  blockedReason
}: {
  campaignId: string;
  mailto: string;
  addresses: string[];
  subject: string;
  text: string;
  blockedReason: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function markSent() {
    startTransition(async () => {
      const result = await markCampaignSentAction({ campaignId, recipientCount: addresses.length });
      if (result.ok) toast.success('Marked as sent');
      else toast.error(result.error);
    });
  }

  if (blockedReason) {
    return (
      <p className='text-muted-foreground bg-muted/60 rounded-xl px-3 py-2 text-xs'>
        {blockedReason}
      </p>
    );
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <a
        href={mailto}
        className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium'
      >
        <Icons.mail className='size-4' aria-hidden />
        Open in Mail ({addresses.length})
      </a>
      <CopyButton
        text={addresses.join(', ')}
        label='Copy addresses'
        done='Addresses copied. Paste them into BCC.'
      />
      <CopyButton text={`${subject}\n\n${text}`} label='Copy message' done='Message copied' />
      <Button
        variant='ghost'
        size='sm'
        className='rounded-full'
        disabled={pending}
        onClick={markSent}
      >
        <Icons.check />
        I sent it
      </Button>
    </div>
  );
}
