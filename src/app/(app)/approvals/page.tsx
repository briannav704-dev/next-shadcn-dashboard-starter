import type { Metadata } from 'next';

import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { ApprovalCard } from '@/features/core/components/approval-card';
import { textingConnected } from '@/features/kouture/server/twilio';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Approvals' };

export default async function ApprovalsPage() {
  const { repos } = await requireOwnerPage();
  const approvals = await repos.core.listApprovals({ limit: 100 });
  const pending = approvals.filter((a) => a.status === 'pending');
  const decided = approvals.filter((a) => a.status !== 'pending');
  const texting = textingConnected();

  return (
    <PageContainer
      eyebrow='Oversight'
      pageTitle='Approvals'
      pageDescription='Nothing leaves the app (messages, posts, appointment changes, refunds or purchases) until you approve it here. What you see is exactly what will run.'
    >
      <section aria-labelledby='pending-heading' className='space-y-4'>
        <h2
          id='pending-heading'
          className='text-gold-ink text-xs font-medium tracking-[0.2em] uppercase'
        >
          Waiting for you · {pending.length}
        </h2>
        {pending.length === 0 ? (
          <EmptyNote>You’re all caught up.</EmptyNote>
        ) : (
          pending.map((a) => <ApprovalCard key={a.id} approval={a} textingConnected={texting} />)
        )}
      </section>
      {decided.length > 0 && (
        <section aria-labelledby='decided-heading' className='mt-10 space-y-4'>
          <h2
            id='decided-heading'
            className='text-gold-ink text-xs font-medium tracking-[0.2em] uppercase'
          >
            Decided
          </h2>
          {decided.map((a) => (
            <ApprovalCard key={a.id} approval={a} textingConnected={texting} />
          ))}
        </section>
      )}
    </PageContainer>
  );
}
