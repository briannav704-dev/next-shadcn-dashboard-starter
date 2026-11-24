'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { type ActionResult, runAction } from '@/server/action-result';
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
