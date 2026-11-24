import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { ChannelDot } from '@/features/kouture/components/marketing-chip';
import {
  FORMS,
  MARKETING_CHANNEL_LABEL,
  MARKETING_KIND_LABEL,
  MARKETING_STATUS_LABEL,
  SOCIAL_CHANNELS
} from '@/features/kouture/forms';
import { relativeDayLabel, todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { MARKETING_STATUSES } from '@/server/entities/definitions';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Social planner' };

const NEXT: Partial<
  Record<(typeof MARKETING_STATUSES)[number], (typeof MARKETING_STATUSES)[number]>
> = {
  idea: 'drafting',
  drafting: 'ready',
  ready: 'scheduled',
  scheduled: 'published'
};

const socialFields = FORMS.marketing.map((f) =>
  f.name === 'channel'
    ? {
        ...f,
        options: f.options?.filter((o) => (SOCIAL_CHANNELS as readonly string[]).includes(o.value))
      }
    : f
);

export default async function SocialPage() {
  const { repos, profile } = await requireOwnerPage();
  const today = todayKey(profile.timezone);
  const all = await repos
    .entities('kouture.marketing_items')
    .list({ order: [{ field: 'scheduledOn' }] });
  const posts = all.filter(
    (i) =>
      (SOCIAL_CHANNELS as readonly string[]).includes(i.channel) &&
      (i.status !== 'published' || (i.scheduledOn ?? '') >= today.slice(0, 8))
  );

  return (
    <PageContainer
      eyebrow='Kouture · Growth'
      pageTitle='Social planner'
      pageDescription='Move each post from idea to published. Posting stays with you until your Marketing Director can request it for approval in Phase 5.'
      pageHeaderAction={
        <AddButton
          entity='kouture.marketing_items'
          label='New post'
          title='New post'
          fields={socialFields}
          initial={{ channel: 'instagram', kind: 'post', status: 'idea' }}
        />
      }
    >
      <div className='-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0'>
        {MARKETING_STATUSES.map((status) => {
          const column = posts.filter((p) => p.status === status);
          return (
            <section
              key={status}
              aria-label={MARKETING_STATUS_LABEL[status]}
              className='bg-muted/40 w-64 shrink-0 snap-start rounded-2xl p-3 md:w-auto'
            >
              <h2 className='mb-3 flex items-center justify-between px-1 text-sm font-medium'>
                {MARKETING_STATUS_LABEL[status]}
                <span className='text-muted-foreground text-xs tabular-nums'>{column.length}</span>
              </h2>
              <ul className='space-y-2.5'>
                {column.map((post) => {
                  const next = NEXT[post.status];
                  return (
                    <li key={post.id} className='lux-card p-3'>
                      <div className='flex items-start gap-2'>
                        <p
                          className={cn(
                            'min-w-0 flex-1 text-sm leading-snug',
                            post.status === 'published' && 'text-muted-foreground'
                          )}
                        >
                          {post.title}
                        </p>
                        <RowActions
                          entity='kouture.marketing_items'
                          id={post.id}
                          label={post.title}
                          fields={socialFields}
                          values={post}
                          extra={
                            next
                              ? [
                                  {
                                    label: `Move to ${MARKETING_STATUS_LABEL[next]}`,
                                    icon: 'arrowRight',
                                    patch: { status: next }
                                  }
                                ]
                              : []
                          }
                        />
                      </div>
                      <p className='text-muted-foreground mt-2 flex items-center gap-1.5 text-xs'>
                        <ChannelDot channel={post.channel} />
                        {MARKETING_CHANNEL_LABEL[post.channel]} · {MARKETING_KIND_LABEL[post.kind]}
                      </p>
                      {post.scheduledOn && (
                        <p
                          className={cn(
                            'mt-1 text-xs',
                            post.scheduledOn < today && post.status !== 'published'
                              ? 'text-destructive'
                              : 'text-gold-ink'
                          )}
                        >
                          {relativeDayLabel(post.scheduledOn, today)}
                        </p>
                      )}
                      {post.caption && (
                        <p className='text-muted-foreground mt-2 line-clamp-3 text-xs'>
                          {post.caption}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </PageContainer>
  );
}
