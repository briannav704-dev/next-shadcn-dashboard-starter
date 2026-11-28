'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { type ActionResult, runAction } from '@/server/action-result';
import { isTextCampaign, sendApprovedTexts } from '@/features/kouture/server/send-texts';
import { AppError } from '@/server/errors';
import { requireOwnerAction } from '@/server/session';

const decideSchema = z.object({
  approvalId: z.string().min(1).max(64),
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).optional()
});

/**
 * Records the owner's decision. Approving does not execute anything yet; the
 * executor that performs the approved action (send, publish, refund…) arrives
 * with the integrations in Phase 6 and only ever runs approved, unexpired items.
 */
export async function decideApprovalAction(
  input: z.infer<typeof decideSchema>
): Promise<ActionResult> {
  return runAction(decideSchema, input, async ({ approvalId, decision, note }) => {
    const { repos } = await requireOwnerAction();
    await repos.core.decideApproval(approvalId, decision, note || null);
    revalidatePath('/', 'layout');
    return undefined;
  });
}

const runSchema = z.object({ approvalId: z.string().min(1).max(64) });

/**
 * Runs an approved request, once. Text campaigns are sent through Twilio;
 * anything the app can't do itself is marked done after the owner did it.
 */
export async function runApprovedAction(
  input: z.infer<typeof runSchema>
): Promise<ActionResult<{ summary: string }>> {
  return runAction(runSchema, input, async ({ approvalId }) => {
    const session = await requireOwnerAction();
    const now = new Date();
    const approval = (await session.repos.core.listApprovals({ limit: 200 })).find(
      (a) => a.id === approvalId
    );
    if (!approval) throw new AppError('NOT_FOUND', 'That request no longer exists.');
    if (approval.status !== 'approved') {
      throw new AppError('CONFLICT', `This request is ${approval.status}, not waiting to run.`);
    }
    let summary: string;
    if (isTextCampaign(approval)) {
      summary = await sendApprovedTexts(session, approval, now);
    } else {
      summary = 'Marked done by you.';
      await session.repos.core.completeApproval(approval.id, 'executed', summary);
    }
    revalidatePath('/', 'layout');
    return { summary };
  });
}
