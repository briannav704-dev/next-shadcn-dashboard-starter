import Link from 'next/link';

import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { Icons } from '@/components/icons';
import type { Approval } from '@/server/data/types';

import { ACTION_LABEL, agentLabel } from '../lib/labels';

export function ApprovalsPreview({ approvals }: { approvals: Approval[] }) {
  return (
    <SectionCard
      title='Waiting for you'
      eyebrow='Approvals'
      action={
        <Link href='/approvals' className='text-primary text-xs font-medium hover:underline'>
          Review all
        </Link>
      }
    >
      {approvals.length === 0 ? (
        <EmptyNote>Nothing needs your approval. Your team is handling the rest.</EmptyNote>
      ) : (
        <ul className='space-y-2'>
          {approvals.slice(0, 3).map((a) => (
            <li key={a.id}>
              <Link
                href={`/approvals#${a.id}`}
                className='hover:bg-muted/70 hover:border-champagne/50 flex items-start gap-3 rounded-xl border border-transparent p-2.5 transition-colors'
              >
                <span className='bg-blush text-rose mt-0.5 grid size-8 shrink-0 place-items-center rounded-full'>
                  <Icons.agent className='size-4' aria-hidden />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-sm font-medium'>{a.title}</span>
                  <span className='text-muted-foreground block truncate text-xs'>
                    {agentLabel(a.requestedBy)} · {ACTION_LABEL[a.actionType]}
                  </span>
                </span>
                <Icons.chevronRight
                  className='text-muted-foreground mt-2 size-4 shrink-0'
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
