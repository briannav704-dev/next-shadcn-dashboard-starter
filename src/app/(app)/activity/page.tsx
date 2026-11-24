import type { Metadata } from 'next';
import Link from 'next/link';

import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { actorLabel } from '@/features/core/lib/labels';
import { cn } from '@/lib/utils';
import type { Domain } from '@/server/data/types';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Activity log' };

const FILTERS: { value: Domain | 'all'; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'life', label: 'My Life' },
  { value: 'kouture', label: 'Kouture' },
  { value: 'core', label: 'Approvals & system' }
];

type PageProps = { searchParams: Promise<{ domain?: string }> };

export default async function ActivityPage({ searchParams }: PageProps) {
  const { repos, profile } = await requireOwnerPage();
  const { domain: raw } = await searchParams;
  const domain = FILTERS.some((f) => f.value === raw && raw !== 'all')
    ? (raw as Domain)
    : undefined;
  const entries = await repos.core.listAudit({ domain, limit: 200 });
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: profile.timezone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  return (
    <PageContainer
      eyebrow='Oversight'
      pageTitle='Activity log'
      pageDescription='Every change, by you or your AI team, recorded permanently. Entries can’t be edited or deleted.'
    >
      <nav aria-label='Filter activity' className='mb-5 flex flex-wrap gap-2'>
        {FILTERS.map((f) => {
          const active = (domain ?? 'all') === f.value;
          return (
            <Link
              key={f.value}
              href={f.value === 'all' ? '/activity' : `/activity?domain=${f.value}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:border-champagne/60 hover:text-foreground'
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>
      {entries.length === 0 ? (
        <EmptyNote>
          No activity yet. Check off a habit or decide an approval and it will appear here.
        </EmptyNote>
      ) : (
        <ol className='lux-card divide-border/70 divide-y'>
          {entries.map((e) => (
            <li key={e.id} className='flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3'>
              <time
                dateTime={e.occurredAt}
                className='text-muted-foreground w-36 shrink-0 text-xs tabular-nums'
              >
                {fmt.format(new Date(e.occurredAt))}
              </time>
              <p className='min-w-0 flex-1 text-sm'>{e.summary}</p>
              <span className='text-gold-ink text-[0.68rem] font-medium tracking-wide'>
                {actorLabel(e.actorType, e.actorId)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </PageContainer>
  );
}
