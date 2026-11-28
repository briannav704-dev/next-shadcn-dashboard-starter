'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Approval } from '@/server/data/types';

import { ACTION_LABEL, agentLabel } from '../lib/labels';
import { decideApprovalAction, runApprovedAction } from '../server/actions';

const RISK_STYLE: Record<Approval['risk'], string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-champagne/25 text-gold-ink',
  high: 'bg-destructive/10 text-destructive'
};

const STATUS_STYLE: Record<Approval['status'], string> = {
  pending: 'bg-blush text-secondary-foreground',
  approved: 'bg-success/12 text-success',
  rejected: 'bg-muted text-muted-foreground',
  executed: 'bg-success/12 text-success',
  failed: 'bg-destructive/10 text-destructive',
  expired: 'bg-muted text-muted-foreground'
};

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(iso));
}

/** Pretty-prints the frozen payload so you see exactly what would run. */
function PayloadView({ payload }: { payload: Record<string, unknown> }) {
  // sourceKey is the team's internal de-duplication key, not something to review.
  const entries = Object.entries(payload).filter(([key]) => key !== 'sourceKey');
  if (entries.length === 0) return null;
  return (
    <dl className='bg-muted/60 mt-3 grid gap-x-4 gap-y-1.5 rounded-xl p-3 text-xs sm:grid-cols-[8rem_1fr]'>
      {entries.map(([key, value]) => (
        <div key={key} className='contents'>
          <dt className='text-muted-foreground capitalize'>
            {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
          </dt>
          <dd className='min-w-0 break-words whitespace-pre-wrap'>
            {Array.isArray(value)
              ? value
                  .map((v) =>
                    v && typeof v === 'object'
                      ? (() => {
                          const item = v as Record<string, unknown>;
                          if (!item.name) return JSON.stringify(v);
                          return item.quantity
                            ? `${item.name} ×${item.quantity}`
                            : String(item.name);
                        })()
                      : String(v)
                  )
                  .join(', ')
              : typeof value === 'object'
                ? JSON.stringify(value)
                : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ApprovalCard({
  approval,
  textingConnected = false
}: {
  approval: Approval;
  textingConnected?: boolean;
}) {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [pending, startTransition] = useTransition();
  const isPending = approval.status === 'pending';

  const isText =
    approval.domain === 'kouture' &&
    approval.actionType === 'send_message' &&
    approval.payload.channel === 'sms';
  const recipientCount = Array.isArray(approval.payload.recipients)
    ? approval.payload.recipients.length
    : 0;

  function run(manual = false) {
    startTransition(async () => {
      const result = await runApprovedAction({ approvalId: approval.id, manual });
      if (result.ok) toast.success(result.data.summary);
      else toast.error(result.error);
    });
  }

  function decide(decision: 'approved' | 'rejected') {
    startTransition(async () => {
      const result = await decideApprovalAction({
        approvalId: approval.id,
        decision,
        note: note || undefined
      });
      if (result.ok) {
        toast.success(
          decision === 'approved'
            ? 'Approved. It will run once integrations are connected.'
            : 'Declined.'
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <article
      id={approval.id}
      className='lux-card scroll-mt-20 p-5'
      aria-labelledby={`${approval.id}-title`}
    >
      <header className='flex flex-wrap items-start gap-3'>
        <span className='bg-blush text-rose grid size-10 shrink-0 place-items-center rounded-full'>
          <Icons.agent className='size-5' aria-hidden />
        </span>
        <div className='min-w-0 flex-1'>
          <p className='text-gold-ink text-[0.65rem] font-medium tracking-[0.18em] uppercase'>
            {agentLabel(approval.requestedBy)} ·{' '}
            {approval.domain === 'kouture' ? 'Kouture' : 'My Life'}
          </p>
          <h2
            id={`${approval.id}-title`}
            className='font-display mt-0.5 text-xl leading-snug font-medium'
          >
            {approval.title}
          </h2>
        </div>
        <div className='flex flex-wrap gap-1.5'>
          <Badge className='bg-secondary text-secondary-foreground rounded-full font-normal'>
            {ACTION_LABEL[approval.actionType]}
          </Badge>
          <Badge className={cn('rounded-full font-normal capitalize', RISK_STYLE[approval.risk])}>
            {approval.risk} risk
          </Badge>
          {!isPending && (
            <Badge
              className={cn('rounded-full font-normal capitalize', STATUS_STYLE[approval.status])}
            >
              {approval.status}
            </Badge>
          )}
        </div>
      </header>

      <p className='text-foreground/85 mt-3 text-sm'>{approval.summary}</p>
      <PayloadView payload={approval.payload} />

      <footer className='mt-4 flex flex-wrap items-center justify-between gap-3'>
        <p className='text-muted-foreground text-xs'>
          Requested {formatWhen(approval.createdAt)}
          {isPending ? ` · expires ${formatWhen(approval.expiresAt)}` : ''}
          {approval.decidedAt ? ` · decided ${formatWhen(approval.decidedAt)}` : ''}
          {approval.decisionNote ? ` · “${approval.decisionNote}”` : ''}
        </p>
        {approval.status === 'approved' &&
          (isText ? (
            textingConnected ? (
              <Button
                size='lg'
                className='rounded-full px-5'
                onClick={() => run()}
                disabled={pending}
              >
                {pending ? <Icons.spinner className='animate-spin' /> : <Icons.send />}
                Send {recipientCount} {recipientCount === 1 ? 'text' : 'texts'}
              </Button>
            ) : (
              <div className='flex flex-wrap items-center gap-2'>
                <p className='text-muted-foreground max-w-xs text-xs'>
                  Automatic texting is off. Send these yourself (Copy on Client retention), then
                  mark them sent.
                </p>
                <Button
                  variant='outline'
                  size='lg'
                  className='rounded-full px-4'
                  onClick={() => run(true)}
                  disabled={pending}
                >
                  <Icons.check />
                  I sent these myself
                </Button>
              </div>
            )
          ) : (
            <Button
              variant='outline'
              size='lg'
              className='rounded-full px-4'
              onClick={() => run()}
              disabled={pending}
            >
              {pending ? <Icons.spinner className='animate-spin' /> : <Icons.check />}
              I did this
            </Button>
          ))}
        {isPending && (
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setShowNote((v) => !v)}
              disabled={pending}
            >
              {showNote ? 'Hide note' : 'Add note'}
            </Button>
            <Button
              variant='outline'
              size='lg'
              className='rounded-full px-4'
              onClick={() => decide('rejected')}
              disabled={pending}
            >
              Decline
            </Button>
            <Button
              size='lg'
              className='rounded-full px-5 shadow-sm'
              onClick={() => decide('approved')}
              disabled={pending}
            >
              {pending ? <Icons.spinner className='animate-spin' /> : <Icons.check />}
              Approve
            </Button>
          </div>
        )}
      </footer>
      {isPending && showNote && (
        <Textarea
          className='mt-3'
          placeholder='Optional note for the record (e.g. “change the discount to 15%”)'
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          aria-label='Decision note'
        />
      )}
    </article>
  );
}
