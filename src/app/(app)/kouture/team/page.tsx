import type { Metadata } from 'next';
import Link from 'next/link';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { AGENTS, TEAM_ORDER } from '@/features/team/agents';
import { RunTeamButton, SeverityPill, TaskActions } from '@/features/team/components/team-controls';
import { cn } from '@/lib/utils';
import type { AgentTask } from '@/server/data/types';
import { TeamUpdateNeeded } from '@/features/team/components/update-needed';
import { isAppError } from '@/server/errors';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'AI management team' };

const RANK: Record<AgentTask['severity'], number> = { urgent: 0, attention: 1, info: 2 };

export default async function TeamPage() {
  const { repos, profile } = await requireOwnerPage();
  const loaded = await Promise.all([
    repos.team.listTasks({ status: 'open' }),
    repos.team.listMessages({ limit: 50 }),
    repos.core.listApprovals({ status: 'pending', limit: 50 })
  ]).catch((error: unknown) => {
    if (isAppError(error) && error.code === 'INVALID') return null;
    throw error;
  });
  if (!loaded) return <TeamUpdateNeeded />;
  const [openTasks, messages, pending] = loaded;
  const ceoBriefing = messages.find((m) => m.agentKey === 'ceo' && m.kind === 'briefing') ?? null;
  const tasks = openTasks.toSorted(
    (a, b) =>
      RANK[a.severity] - RANK[b.severity] ||
      TEAM_ORDER.indexOf(a.agentKey) - TEAM_ORDER.indexOf(b.agentKey)
  );
  const fromTeam = pending.filter((a) => a.domain === 'kouture' && a.requestedBy in AGENTS);
  const briefedAt = ceoBriefing
    ? new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: profile.timezone
      }).format(new Date(ceoBriefing.createdAt))
    : null;

  return (
    <PageContainer
      eyebrow='Kouture · AI management team'
      pageTitle='Your team'
      pageDescription='Seven specialists check the salon every day, keep their own to-do lists, and draft anything outward for your approval. Nothing is sent without your yes.'
      pageHeaderAction={<RunTeamButton lastRunAt={ceoBriefing?.createdAt ?? null} />}
    >
      <div className='grid gap-5 lg:grid-cols-12'>
        <div className='flex flex-col gap-5 lg:col-span-7'>
          <SectionCard
            title={`${AGENTS.ceo.name}’s briefing`}
            eyebrow={briefedAt ? `CEO · ${briefedAt}` : 'CEO'}
            action={
              <Link href='/kouture/team/ceo' className='text-rose text-sm hover:underline'>
                Chat
              </Link>
            }
          >
            {ceoBriefing ? (
              <p className='text-sm leading-relaxed whitespace-pre-line'>{ceoBriefing.body}</p>
            ) : (
              <EmptyNote>The team is checking in for the first time…</EmptyNote>
            )}
            {fromTeam.length > 0 && (
              <Link
                href='/approvals'
                className='bg-blush/60 hover:bg-blush mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors'
              >
                <Icons.approvals className='text-rose size-4' aria-hidden />
                <span className='flex-1'>
                  {fromTeam.length} {fromTeam.length === 1 ? 'request' : 'requests'} waiting for
                  your approval
                </span>
                <Icons.chevronRight className='size-4' aria-hidden />
              </Link>
            )}
          </SectionCard>

          <SectionCard title='Needs attention' eyebrow={`${tasks.length} open across the team`}>
            {tasks.length === 0 ? (
              <EmptyNote>All clear. The team closes items on its own as they’re handled.</EmptyNote>
            ) : (
              <ul className='divide-border/60 divide-y'>
                {tasks.map((t) => (
                  <li key={t.id} className='flex items-start gap-3 py-3'>
                    <div className='min-w-0 flex-1'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <SeverityPill severity={t.severity} />
                        <span className='text-muted-foreground text-xs'>
                          {AGENTS[t.agentKey].name} · {AGENTS[t.agentKey].title}
                        </span>
                      </div>
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
        </div>

        <div className='lg:col-span-5'>
          <SectionCard title='The team' eyebrow='Tap to chat'>
            <ul className='space-y-2'>
              {TEAM_ORDER.map((key) => {
                const agent = AGENTS[key];
                const Icon = Icons[agent.icon];
                const count = openTasks.filter((t) => t.agentKey === key).length;
                const urgent = openTasks.some((t) => t.agentKey === key && t.severity === 'urgent');
                return (
                  <li key={key}>
                    <Link
                      href={`/kouture/team/${key}`}
                      className='hover:bg-blush/40 -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors'
                    >
                      <span className='bg-blush text-rose grid size-10 shrink-0 place-items-center rounded-full'>
                        <Icon className='size-5' aria-hidden />
                      </span>
                      <div className='min-w-0 flex-1'>
                        <p className='text-sm font-medium'>{agent.name}</p>
                        <p className='text-muted-foreground truncate text-xs'>{agent.title}</p>
                      </div>
                      {count > 0 && (
                        <span
                          className={cn(
                            'grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                            urgent ? 'bg-destructive text-white' : 'bg-champagne/40 text-gold-ink'
                          )}
                          aria-label={`${count} open`}
                        >
                          {count}
                        </span>
                      )}
                      <Icons.chevronRight className='text-muted-foreground size-4' aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
          <p className='text-muted-foreground mt-4 text-xs leading-relaxed'>
            The team runs on built-in rules today, at no cost. Your notes to each agent are saved
            for when you switch on an AI brain. Every action is recorded in the Activity log under
            the agent’s name.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
