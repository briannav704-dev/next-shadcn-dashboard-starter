import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { ACTION_LABEL } from '@/features/core/lib/labels';
import { AGENTS, isAgentKey } from '@/features/team/agents';
import { AgentChat, SeverityPill, TaskActions } from '@/features/team/components/team-controls';
import { TeamUpdateNeeded } from '@/features/team/components/update-needed';
import { isAppError } from '@/server/errors';
import { requireOwnerPage } from '@/server/session';

type PageProps = { params: Promise<{ agent: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { agent } = await params;
  return { title: isAgentKey(agent) ? `${AGENTS[agent].name} · ${AGENTS[agent].title}` : 'Team' };
}

export default async function AgentPage({ params }: PageProps) {
  const { agent: key } = await params;
  if (!isAgentKey(key)) notFound();
  const agent = AGENTS[key];
  const Icon = Icons[agent.icon];
  const { repos, profile } = await requireOwnerPage();
  const loaded = await Promise.all([
    repos.team.listTasks({ status: 'open', agentKey: key }),
    repos.team.listTasks({ agentKey: key, limit: 40 }),
    repos.team.listMessages({ agentKey: key, limit: 60 }),
    repos.core.listApprovals({ limit: 50 })
  ]).catch((error: unknown) => {
    if (isAppError(error) && error.code === 'INVALID') return null;
    throw error;
  });
  if (!loaded) return <TeamUpdateNeeded />;
  const [open, history, messages, approvals] = loaded;
  const closed = history.filter((t) => t.status !== 'open').slice(0, 15);
  const requests = approvals.filter((a) => a.requestedBy === key).slice(0, 8);
  const when = (iso: string) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: profile.timezone
    }).format(new Date(iso));

  return (
    <PageContainer
      eyebrow={`Kouture · ${agent.title}`}
      pageTitle={agent.name}
      pageDescription={agent.mission}
      pageHeaderAction={
        <Link
          href='/kouture/team'
          className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm'
        >
          <Icons.chevronLeft className='size-4' />
          The team
        </Link>
      }
    >
      <div className='grid gap-5 lg:grid-cols-12'>
        <div className='lg:col-span-7'>
          <SectionCard title={`Chat with ${agent.name}`} eyebrow='Quick answers · AI brain off'>
            <AgentChat
              agent={key}
              agentName={agent.name}
              messages={messages.toReversed()}
              quickAsks={agent.quickAsks}
              timeZone={profile.timezone}
            />
          </SectionCard>
        </div>
        <div className='flex flex-col gap-5 lg:col-span-5'>
          <SectionCard title='On my list' eyebrow={`${open.length} open`}>
            {open.length === 0 ? (
              <EmptyNote>Nothing needs you from me right now.</EmptyNote>
            ) : (
              <ul className='divide-border/60 divide-y'>
                {open.map((t) => (
                  <li key={t.id} className='flex items-start gap-3 py-3'>
                    <div className='min-w-0 flex-1'>
                      <SeverityPill severity={t.severity} />
                      {t.href ? (
                        <Link
                          href={t.href}
                          className='hover:text-rose mt-1 block text-sm font-medium hover:underline'
                        >
                          {t.title}
                        </Link>
                      ) : (
                        <p className='mt-1 text-sm font-medium'>{t.title}</p>
                      )}
                      {t.detail && (
                        <p className='text-muted-foreground mt-0.5 text-xs leading-relaxed'>
                          {t.detail}
                        </p>
                      )}
                    </div>
                    <TaskActions task={t} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title='What I do' eyebrow='Role & limits'>
            <div className='flex items-start gap-3'>
              <span className='bg-blush text-rose grid size-10 shrink-0 place-items-center rounded-full'>
                <Icon className='size-5' aria-hidden />
              </span>
              <div className='min-w-0 space-y-3 text-sm'>
                <div>
                  <p className='text-muted-foreground text-xs'>I watch</p>
                  <p>{agent.watches.join(' · ')}</p>
                </div>
                <div>
                  <p className='text-muted-foreground text-xs'>I can draft for your approval</p>
                  <p>
                    {agent.drafts.length ? agent.drafts.join(' · ') : 'Nothing; I advise only.'}
                  </p>
                </div>
                <p className='text-muted-foreground text-xs leading-relaxed'>
                  I can’t send messages, post, spend money or change bookings on my own. I never see
                  your personal My Life data.
                </p>
              </div>
            </div>
          </SectionCard>

          {requests.length > 0 && (
            <SectionCard title='My requests' eyebrow='Approvals'>
              <ul className='divide-border/60 divide-y'>
                {requests.map((a) => (
                  <li key={a.id} className='flex items-center gap-3 py-2.5 text-sm'>
                    <Link
                      href={`/approvals#${a.id}`}
                      className='hover:text-rose min-w-0 flex-1 truncate hover:underline'
                    >
                      {a.title}
                    </Link>
                    <span className='text-muted-foreground shrink-0 text-xs capitalize'>
                      {a.status === 'pending' ? ACTION_LABEL[a.actionType] : a.status}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          <SectionCard title='History' eyebrow='Recently cleared'>
            {closed.length === 0 ? (
              <EmptyNote>Items I close or you dismiss show up here.</EmptyNote>
            ) : (
              <ul className='space-y-2'>
                {closed.map((t) => (
                  <li key={t.id} className='flex items-center gap-3 text-sm'>
                    <Icons.check className='text-success size-4 shrink-0' aria-hidden />
                    <span className='text-muted-foreground min-w-0 flex-1 truncate'>{t.title}</span>
                    <span className='text-muted-foreground shrink-0 text-xs'>
                      {t.status === 'dismissed' ? 'dismissed' : when(t.resolvedAt ?? t.updatedAt)}
                    </span>
                    <TaskActions task={t} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
