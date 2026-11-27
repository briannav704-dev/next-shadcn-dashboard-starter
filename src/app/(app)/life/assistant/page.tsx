import type { Metadata } from 'next';
import Link from 'next/link';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { ASSISTANT } from '@/features/assistant/rules';
import {
  AgentChat,
  RunTeamButton,
  SeverityPill,
  TaskActions
} from '@/features/team/components/team-controls';
import { isAppError } from '@/server/errors';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Personal assistant' };

const RANK = { urgent: 0, attention: 1, info: 2 } as const;

export default async function AssistantPage() {
  const { repos, profile } = await requireOwnerPage();
  const loaded = await Promise.all([
    repos.assistant.listTasks({ status: 'open' }),
    repos.assistant.listTasks({ limit: 30 }),
    repos.assistant.listMessages(60)
  ]).catch((error: unknown) => {
    if (isAppError(error) && error.code === 'INVALID') return error.message;
    throw error;
  });
  if (typeof loaded === 'string') {
    return (
      <PageContainer eyebrow='My Life' pageTitle='One quick database update'>
        <SectionCard title='Add your assistant to your database' eyebrow='About 1 minute'>
          <ol className='text-muted-foreground list-decimal space-y-2 pl-5 text-sm leading-relaxed'>
            <li>
              On GitHub, open{' '}
              <strong>supabase/migrations/20261129000001_personal_assistant.sql</strong> and tap{' '}
              <strong>Copy raw file</strong>.
            </li>
            <li>
              In Supabase, go to <strong>SQL Editor → New query</strong>, paste, and tap{' '}
              <strong>Run</strong>.
            </li>
            <li>Come back and refresh this page.</li>
          </ol>
        </SectionCard>
      </PageContainer>
    );
  }
  const [open, history, messages] = loaded;
  const tasks = open.toSorted((a, b) => RANK[a.severity] - RANK[b.severity]);
  const closed = history.filter((t) => t.status !== 'open').slice(0, 10);
  const lastBriefing = messages.find((m) => m.kind === 'briefing') ?? null;

  return (
    <PageContainer
      eyebrow='My Life · Personal assistant'
      pageTitle={ASSISTANT.name}
      pageDescription={`${ASSISTANT.mission} Private to you: she never shares anything with your salon team.`}
      pageHeaderAction={
        <RunTeamButton
          lastRunAt={lastBriefing?.createdAt ?? null}
          scope={{ kind: 'assistant' }}
          label='Check in'
        />
      }
    >
      <div className='grid gap-5 lg:grid-cols-12'>
        <div className='lg:col-span-7'>
          <SectionCard title={`Chat with ${ASSISTANT.name}`} eyebrow='Quick answers · AI brain off'>
            <AgentChat
              scope={{ kind: 'assistant' }}
              agentName={ASSISTANT.name}
              messages={messages.toReversed()}
              quickAsks={ASSISTANT.quickAsks}
              timeZone={profile.timezone}
            />
          </SectionCard>
        </div>
        <div className='flex flex-col gap-5 lg:col-span-5'>
          <SectionCard title='On my list' eyebrow={`${tasks.length} open`}>
            {tasks.length === 0 ? (
              <EmptyNote>Nothing needs you right now. Enjoy it.</EmptyNote>
            ) : (
              <ul className='divide-border/60 divide-y'>
                {tasks.map((t) => (
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
                    <TaskActions task={t} scope={{ kind: 'assistant' }} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard title='What I do' eyebrow='Role & limits'>
            <div className='flex items-start gap-3'>
              <span className='bg-blush text-rose grid size-10 shrink-0 place-items-center rounded-full'>
                <Icons.heart className='size-5' aria-hidden />
              </span>
              <div className='min-w-0 space-y-2 text-sm'>
                <p>{ASSISTANT.watches.join(' · ')}</p>
                <p className='text-muted-foreground text-xs leading-relaxed'>
                  I only ever see My Life, never the salon. I notice that you journaled, never what
                  you wrote. I can’t send, buy or change anything on my own.
                </p>
              </div>
            </div>
          </SectionCard>
          {closed.length > 0 && (
            <SectionCard title='History' eyebrow='Recently cleared'>
              <ul className='space-y-2'>
                {closed.map((t) => (
                  <li key={t.id} className='flex items-center gap-3 text-sm'>
                    <Icons.check className='text-success size-4 shrink-0' aria-hidden />
                    <span className='text-muted-foreground min-w-0 flex-1 truncate'>{t.title}</span>
                    <TaskActions task={t} scope={{ kind: 'assistant' }} />
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
