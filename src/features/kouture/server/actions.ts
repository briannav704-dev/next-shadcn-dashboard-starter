'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { type ActionResult, runAction } from '@/server/action-result';
import { AppError } from '@/server/errors';
import { requireOwnerAction } from '@/server/session';

import { type SyncSummary, syncNailzyCalendar } from './nailzy-sync';

const id = z.string().min(1).max(64);

function refreshAppointments() {
  for (const path of ['/kouture', '/kouture/appointments', '/kouture/clients', '/kouture/money']) {
    revalidatePath(path);
  }
}

export async function syncNailzyAction(): Promise<ActionResult<SyncSummary>> {
  return runAction(z.object({}), {}, async () => {
    const { repos, mode, profile } = await requireOwnerAction();
    const summary = await syncNailzyCalendar(repos, { mode, timeZone: profile.timezone });
    refreshAppointments();
    if (!summary.ok) throw new AppError('INVALID', summary.message ?? 'Sync failed.');
    return summary;
  });
}

const checkoutSchema = z.object({
  appointmentId: id,
  depositPaid: z.boolean(),
  balanceCents: z.number().int().min(0).max(10_000_000),
  balanceMethod: z.enum(['cash', 'stripe', 'other']),
  tipCents: z.number().int().min(0).max(10_000_000)
});

/** Completes a visit and records the money taken for it, in one step. */
export async function checkoutAppointmentAction(
  input: z.infer<typeof checkoutSchema>
): Promise<ActionResult> {
  return runAction(checkoutSchema, input, async (data) => {
    const { repos } = await requireOwnerAction();
    const appointments = repos.entities('kouture.appointments');
    const payments = repos.entities('kouture.payments');
    const appt = await appointments.get(data.appointmentId);
    if (appt.status === 'completed') throw new AppError('CONFLICT', 'Already checked out.');
    if (appt.status === 'cancelled') throw new AppError('CONFLICT', 'This visit was cancelled.');

    const existing = await payments.list({ eq: { appointmentId: appt.id } });
    const receivedAt = new Date().toISOString();
    const base = { appointmentId: appt.id, clientId: appt.clientId, receivedAt };
    const hasDeposit = existing.some((p) => p.kind === 'deposit');
    if (data.depositPaid && !hasDeposit && appt.depositCents > 0) {
      await payments.insert({
        ...base,
        kind: 'deposit',
        method: 'stripe',
        amountCents: appt.depositCents,
        notes: 'Deposit taken at booking'
      });
    }
    if (data.balanceCents > 0) {
      await payments.insert({
        ...base,
        kind: 'balance',
        method: data.balanceMethod,
        amountCents: data.balanceCents
      });
    }
    if (data.tipCents > 0) {
      await payments.insert({ ...base, kind: 'tip', method: 'cash', amountCents: data.tipCents });
    }
    await appointments.update(appt.id, { status: 'completed' });
    refreshAppointments();
    return undefined;
  });
}

const consentSchema = z.object({
  clientId: id,
  channel: z.enum(['sms', 'email']),
  change: z.enum(['granted', 'opted_out', 'cleared'])
});

/**
 * Records marketing consent with a server timestamp (TCPA / CAN-SPAM evidence).
 * Opting out always wins over an earlier consent.
 */
export async function setMarketingConsentAction(
  input: z.infer<typeof consentSchema>
): Promise<ActionResult> {
  return runAction(consentSchema, input, async ({ clientId, channel, change }) => {
    const { repos } = await requireOwnerAction();
    const now = new Date().toISOString();
    const consentField = channel === 'sms' ? 'smsMarketingConsentAt' : 'emailMarketingConsentAt';
    const optOutField = channel === 'sms' ? 'smsOptedOutAt' : 'emailOptedOutAt';
    const patch =
      change === 'granted'
        ? { [consentField]: now, [optOutField]: null }
        : change === 'opted_out'
          ? { [optOutField]: now }
          : { [consentField]: null };
    await repos.entities('kouture.clients').update(clientId, patch);
    revalidatePath('/kouture/clients');
    revalidatePath(`/kouture/clients/${clientId}`);
    revalidatePath('/kouture/retention');
    return undefined;
  });
}

const adjustSchema = z.object({ itemId: id, delta: z.number().min(-1000).max(1000) });

export async function adjustStockAction(
  input: z.infer<typeof adjustSchema>
): Promise<ActionResult> {
  return runAction(adjustSchema, input, async ({ itemId, delta }) => {
    const { repos } = await requireOwnerAction();
    const items = repos.entities('kouture.inventory_items');
    const item = await items.get(itemId);
    await items.update(itemId, {
      onHand: Math.max(0, Math.round((item.onHand + delta) * 100) / 100)
    });
    revalidatePath('/kouture/inventory');
    return undefined;
  });
}
