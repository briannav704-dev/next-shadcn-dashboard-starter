'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AgentKey, AgentMessage, AgentTask } from '@/server/data/types';

import type { QuickAsk } from '../agents';
import {
  askAssistantAction,
  runAssistantAction,
  sendAssistantNoteAction,
  setAssistantTaskStatusAction
} from '@/features/assistant/server/actions';

import {
  askAgentAction,
  runTeamAction,
  sendAgentNoteAction,
  setAgentTaskStatusAction
} from '../server/actions';

type ChatMessage = Pick<AgentMessage, 'id' | 'kind' | 'body' | 'createdAt'> & {
  author: 'owner' | 'agent' | 'assistant';
};

/** Which helper a control talks to: the Kouture team or the My Life assistant. */
export type Scope = { kind: 'team'; agent?: AgentKey } | { kind: 'assistant' };

const STALE_MS = 6 * 3_600_000;

/** Runs the team when its last briefing is stale, and offers a manual run. */
export function RunTeamButton({
  lastRunAt,
  scope = { kind: 'team' },
  label = 'Run the team'
}: {
  lastRunAt: string | null;
  scope?: Scope;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const autoRan = useRef(false);

  function run(force: boolean, quiet = false) {
    startTransition(async () => {
      const result =
        scope.kind === 'team'
          ? await runTeamAction({ force })
          : await runAssistantAction({ force });
      if (!result.ok) {
        if (!quiet) toast.error(result.error);
        return;
      }
      const { opened, closed } = result.data;
      if (!quiet || opened + closed > 0) {
        toast.success(
          opened + closed > 0
            ? `Updated: ${opened} new, ${closed} cleared`
            : 'Checked in: nothing new'
        );
      }
    });
  }

  useEffect(() => {
    if (autoRan.current) return;
    if (lastRunAt && Date.now() - Date.parse(lastRunAt) < STALE_MS) return;
    autoRan.current = true;
    run(false, true);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per visit, only when stale
  }, []);

  return (
    <Button
      variant='outline'
      size='lg'
      className='rounded-full'
      onClick={() => run(true)}
      disabled={pending}
    >
      <Icons.switch className={cn(pending && 'animate-spin')} />
      {pending ? 'Checking…' : label}
    </Button>
  );
}

const SEVERITY_STYLE = {
  urgent: 'bg-destructive/10 text-destructive',
  attention: 'bg-champagne/30 text-gold-ink',
  info: 'bg-muted text-muted-foreground'
} as const;

export function TaskActions({
  task,
  scope = { kind: 'team' }
}: {
  task: Pick<AgentTask, 'id' | 'title' | 'status'>;
  scope?: Scope;
}) {
  const [pending, startTransition] = useTransition();
  function set(status: 'done' | 'dismissed' | 'open') {
    startTransition(async () => {
      const input = { taskId: task.id, status };
      const result =
        scope.kind === 'team'
          ? await setAgentTaskStatusAction(input)
          : await setAssistantTaskStatusAction(input);
      if (!result.ok) toast.error(result.error);
    });
  }
  if (task.status !== 'open') {
    return (
      <Button
        variant='ghost'
        size='sm'
        className='rounded-full'
        disabled={pending}
        onClick={() => set('open')}
      >
        Reopen
      </Button>
    );
  }
  return (
    <div className='flex shrink-0 items-center gap-1'>
      <Button
        variant='ghost'
        size='icon-sm'
        className='rounded-full'
        aria-label={`Mark done: ${task.title}`}
        disabled={pending}
        onClick={() => set('done')}
      >
        <Icons.check />
      </Button>
      <Button
        variant='ghost'
        size='icon-sm'
        className='text-muted-foreground rounded-full'
        aria-label={`Dismiss: ${task.title}`}
        disabled={pending}
        onClick={() => set('dismissed')}
      >
        <Icons.close />
      </Button>
    </div>
  );
}

export function SeverityPill({ severity }: { severity: AgentTask['severity'] }) {
  return (
    <span
      className={cn('rounded-full px-2 py-0.5 text-[0.65rem] capitalize', SEVERITY_STYLE[severity])}
    >
      {severity === 'attention' ? 'needs you' : severity}
    </span>
  );
}

export function AgentChat({
  scope,
  agentName,
  messages,
  quickAsks,
  timeZone
}: {
  scope: Scope;
  agentName: string;
  /** Oldest first. */
  messages: ChatMessage[];
  quickAsks: readonly { id: QuickAsk; label: string }[];
  timeZone: string;
}) {
  const chatId = scope.kind === 'team' ? (scope.agent ?? 'team') : 'assistant';
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  function ask(id: QuickAsk) {
    startTransition(async () => {
      const result =
        scope.kind === 'team' && scope.agent
          ? await askAgentAction({ agent: scope.agent, ask: id })
          : await askAssistantAction({ ask: id });
      if (!result.ok) toast.error(result.error);
    });
  }

  function send(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const result =
        scope.kind === 'team' && scope.agent
          ? await sendAgentNoteAction({ agent: scope.agent, body })
          : await sendAssistantNoteAction({ body });
      if (result.ok) setDraft('');
      else toast.error(result.error);
    });
  }

  const time = (iso: string) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone
    }).format(new Date(iso));

  return (
    <div className='flex flex-col'>
      <div
        className='bg-muted/30 max-h-[28rem] min-h-48 space-y-3 overflow-y-auto rounded-2xl p-3'
        role='log'
        aria-label={`Conversation with ${agentName}`}
      >
        {messages.length === 0 && (
          <p className='text-muted-foreground py-8 text-center text-sm'>
            No messages yet. {agentName} posts a briefing each day.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn('flex', m.author === 'owner' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line',
                m.author === 'owner'
                  ? 'bg-rose text-primary-foreground rounded-br-md'
                  : 'bg-card border-border/60 rounded-bl-md border'
              )}
            >
              {m.kind === 'briefing' && (
                <p className='text-gold-ink mb-1 text-[0.6rem] font-medium tracking-[0.16em] uppercase'>
                  Daily briefing
                </p>
              )}
              {m.body}
              <p
                className={cn(
                  'mt-1 text-[0.65rem]',
                  m.author === 'owner' ? 'text-primary-foreground/75' : 'text-muted-foreground'
                )}
              >
                {time(m.createdAt)}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className='mt-3 flex flex-wrap gap-2'>
        {quickAsks.map((q) => (
          <Button
            key={q.id}
            variant='outline'
            size='sm'
            className='rounded-full'
            disabled={pending}
            onClick={() => ask(q.id)}
          >
            {q.label}
          </Button>
        ))}
      </div>
      <form onSubmit={send} className='mt-3 flex items-end gap-2'>
        <label htmlFor={`note-${chatId}`} className='sr-only'>
          Message {agentName}
        </label>
        <textarea
          id={`note-${chatId}`}
          rows={2}
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Leave ${agentName} a note…`}
          className='border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 min-h-11 flex-1 resize-y rounded-2xl border px-3 py-2 text-base outline-none focus-visible:ring-3 md:text-sm'
        />
        <Button
          type='submit'
          size='icon-lg'
          className='rounded-full'
          disabled={pending || !draft.trim()}
          aria-label='Send'
        >
          {pending ? <Icons.spinner className='animate-spin' /> : <Icons.send />}
        </Button>
      </form>
    </div>
  );
}
