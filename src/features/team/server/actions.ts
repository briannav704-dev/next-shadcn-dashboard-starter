'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { type ActionResult, runAction } from '@/server/action-result';
import { AGENT_KEYS } from '@/server/data/types';
import { requireOwnerAction } from '@/server/session';

import { AGENTS } from '../agents';
import { quickAnswer } from '../rules';

import { type TeamRunResult, runTeamForOwner } from './run-team';

const agentKey = z.enum(AGENT_KEYS);

function refresh(agent?: string) {
  revalidatePath('/kouture/team');
  if (agent) revalidatePath(`/kouture/team/${agent}`);
  revalidatePath('/kouture');
  revalidatePath('/approvals');
}

export async function runTeamAction(input: {
  force: boolean;
}): Promise<ActionResult<TeamRunResult>> {
  return runAction(z.object({ force: z.boolean() }), input, async ({ force }) => {
    const session = await requireOwnerAction();
    const result = await runTeamForOwner(session, { force });
    refresh();
    return result;
  });
}

const taskSchema = z.object({
  taskId: z.string().min(1).max(64),
  status: z.enum(['open', 'done', 'dismissed'])
});

export async function setAgentTaskStatusAction(
  input: z.infer<typeof taskSchema>
): Promise<ActionResult> {
  return runAction(taskSchema, input, async ({ taskId, status }) => {
    const { repos } = await requireOwnerAction();
    await repos.team.setTaskStatus(taskId, status);
    refresh();
    return undefined;
  });
}

const askSchema = z.object({ agent: agentKey, ask: z.enum(['needs', 'update', 'done']) });

/** Instant, rule-based answers in an agent's chat while the AI brain is off. */
export async function askAgentAction(input: z.infer<typeof askSchema>): Promise<ActionResult> {
  return runAction(askSchema, input, async ({ agent, ask }) => {
    const { repos } = await requireOwnerAction();
    const label = AGENTS[agent].quickAsks.find((q) => q.id === ask)?.label ?? ask;
    await repos.team.postOwnerMessage(agent, label);
    const [open, done, briefings] = await Promise.all([
      repos.team.listTasks({ status: 'open', agentKey: agent }),
      repos.team.listTasks({ status: 'done', agentKey: agent, limit: 5 }),
      repos.team.listMessages({ agentKey: agent, limit: 30 })
    ]);
    const briefing = briefings.find((m) => m.kind === 'briefing')?.body ?? null;
    await repos.team.file(agent, {
      kind: 'message',
      messageKind: 'reply',
      body: quickAnswer(ask, { open, done, briefing })
    });
    refresh(agent);
    return undefined;
  });
}

const noteSchema = z.object({
  agent: agentKey,
  body: z.string().trim().min(1, 'Write a message first.').max(2000, 'That’s a bit long.')
});

/** Saves the owner's note to an agent. Free-form replies need the AI brain. */
export async function sendAgentNoteAction(
  input: z.infer<typeof noteSchema>
): Promise<ActionResult> {
  return runAction(noteSchema, input, async ({ agent, body }) => {
    const { repos } = await requireOwnerAction();
    await repos.team.postOwnerMessage(agent, body);
    await repos.team.file(agent, {
      kind: 'message',
      messageKind: 'reply',
      body: 'Noted. I’ve saved this for when my AI brain is switched on; until then I answer the quick questions above and keep running my daily checks.'
    });
    refresh(agent);
    return undefined;
  });
}
