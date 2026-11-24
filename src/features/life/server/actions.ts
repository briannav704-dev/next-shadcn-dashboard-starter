'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { todayKey } from '@/lib/dates';
import { type ActionResult, runAction } from '@/server/action-result';
import { requireOwnerAction } from '@/server/session';

const toggleTaskSchema = z.object({ taskId: z.string().min(1).max(64), done: z.boolean() });

export async function toggleTaskAction(
  input: z.infer<typeof toggleTaskSchema>
): Promise<ActionResult> {
  return runAction(toggleTaskSchema, input, async ({ taskId, done }) => {
    const { repos } = await requireOwnerAction();
    await repos.life.setTaskDone(taskId, done);
    revalidatePath('/life');
    return undefined;
  });
}

const toggleHabitSchema = z.object({ habitId: z.string().min(1).max(64), done: z.boolean() });

export async function toggleHabitTodayAction(
  input: z.infer<typeof toggleHabitSchema>
): Promise<ActionResult> {
  return runAction(toggleHabitSchema, input, async ({ habitId, done }) => {
    const { repos, profile } = await requireOwnerAction();
    // "Today" is computed on the server in the owner's timezone, never trusted from the client.
    await repos.life.setHabitLogged(habitId, todayKey(profile.timezone), done);
    revalidatePath('/life');
    return undefined;
  });
}
