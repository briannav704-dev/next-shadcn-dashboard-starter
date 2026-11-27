'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { quickAnswer } from '@/features/team/rules';
import { type ActionResult, runAction } from '@/server/action-result';
import { requireOwnerAction } from '@/server/session';

import { ASSISTANT } from '../rules';

import { runAssistantForOwner } from './run-assistant';

function refresh() {
  revalidatePath('/life/assistant');
  revalidatePath('/life');
}

export async function runAssistantAction(input: {
  force: boolean;
}): Promise<ActionResult<{ opened: number; closed: number }>> {
  return runAction(z.object({ force: z.boolean() }), input, async ({ force }) => {
    const session = await requireOwnerAction();
    const result = await runAssistantForOwner(session, { force });
    refresh();
    return result;
  });
}

const taskSchema = z.object({
  taskId: z.string().min(1).max(64),
  status: z.enum(['open', 'done', 'dismissed'])
});

export async function setAssistantTaskStatusAction(
  input: z.infer<typeof taskSchema>
): Promise<ActionResult> {
  return runAction(taskSchema, input, async ({ taskId, status }) => {
    const { repos } = await requireOwnerAction();
    await repos.assistant.setTaskStatus(taskId, status);
    refresh();
    return undefined;
  });
}

const askSchema = z.object({ ask: z.enum(['needs', 'update', 'done']) });

export async function askAssistantAction(input: z.infer<typeof askSchema>): Promise<ActionResult> {
  return runAction(askSchema, input, async ({ ask }) => {
    const { repos } = await requireOwnerAction();
    const label = ASSISTANT.quickAsks.find((q) => q.id === ask)?.label ?? ask;
    await repos.assistant.postOwnerMessage(label);
    const [open, done, messages] = await Promise.all([
      repos.assistant.listTasks({ status: 'open' }),
      repos.assistant.listTasks({ status: 'done', limit: 5 }),
      repos.assistant.listMessages(30)
    ]);
    const briefing = messages.find((m) => m.kind === 'briefing')?.body ?? null;
    await repos.assistant.file({
      kind: 'message',
      messageKind: 'reply',
      body: quickAnswer(ask, { open, done, briefing })
    });
    refresh();
    return undefined;
  });
}

const noteSchema = z.object({
  body: z.string().trim().min(1, 'Write a message first.').max(2000, 'That’s a bit long.')
});

export async function sendAssistantNoteAction(
  input: z.infer<typeof noteSchema>
): Promise<ActionResult> {
  return runAction(noteSchema, input, async ({ body }) => {
    const { repos } = await requireOwnerAction();
    await repos.assistant.postOwnerMessage(body);
    await repos.assistant.file({
      kind: 'message',
      messageKind: 'reply',
      body: 'Noted. I’ve saved this for when my AI brain is switched on; until then I answer the quick questions above and keep running my daily checks.'
    });
    refresh();
    return undefined;
  });
}
