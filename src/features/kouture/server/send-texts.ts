import 'server-only';

import type { Approval } from '@/server/data/types';
import { AppError } from '@/server/errors';
import type { OwnerSession } from '@/server/session';

import { consentState } from '../lib/consent';
import { personalize, toE164, withinQuietHours } from '../lib/sms';

import { sendSms, textingConnected } from './twilio';

export function isTextCampaign(approval: Approval): boolean {
  return (
    approval.domain === 'kouture' &&
    approval.actionType === 'send_message' &&
    approval.payload.channel === 'sms'
  );
}

type Recipient = { clientId: string };

/**
 * Sends an approved text campaign. Every recipient is re-checked at send time:
 * consent can be withdrawn after the draft was written.
 */
export async function sendApprovedTexts(session: OwnerSession, approval: Approval, now: Date) {
  if (!textingConnected()) {
    throw new AppError(
      'INVALID',
      'Texting isn’t connected yet. Use Copy on Client retention, or connect Twilio.'
    );
  }
  if (!withinQuietHours(now, session.profile.timezone)) {
    throw new AppError(
      'INVALID',
      'Marketing texts can only go out between 8am and 9pm. Try again then.'
    );
  }
  const body = typeof approval.payload.body === 'string' ? approval.payload.body : null;
  const recipients = Array.isArray(approval.payload.recipients)
    ? (approval.payload.recipients as Recipient[]).filter((r) => typeof r?.clientId === 'string')
    : [];
  if (!body || recipients.length === 0)
    throw new AppError('INVALID', 'This request has no message to send.');

  const clients = session.repos.entities('kouture.clients');
  const tally = { sent: 0, skipped: 0, failed: 0, optedOut: 0 };
  for (const { clientId } of recipients) {
    const client = await clients.get(clientId).catch(() => null);
    const to = toE164(client?.phone ?? null);
    if (
      !client ||
      !to ||
      consentState(client.smsMarketingConsentAt, client.smsOptedOutAt) !== 'subscribed'
    ) {
      tally.skipped++;
      continue;
    }
    const result = await sendSms(to, personalize(body, client.fullName));
    if (result.ok) tally.sent++;
    else if (result.optedOut) {
      tally.optedOut++;
      await clients.update(client.id, { smsOptedOutAt: now.toISOString() });
    } else tally.failed++;
  }
  const summary = `Sent ${tally.sent}${tally.skipped ? `, skipped ${tally.skipped} (no consent or number)` : ''}${tally.optedOut ? `, ${tally.optedOut} had opted out` : ''}${tally.failed ? `, ${tally.failed} failed` : ''}.`;
  await session.repos.core.completeApproval(
    approval.id,
    tally.sent === 0 && tally.failed > 0 ? 'failed' : 'executed',
    summary
  );
  return summary;
}
