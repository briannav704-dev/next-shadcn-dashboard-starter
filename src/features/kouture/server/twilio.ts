import 'server-only';

import { readEnv } from '@/server/env';
import { AppError } from '@/server/errors';

export type SmsResult = { ok: true } | { ok: false; optedOut: boolean; reason: string };

export function textingConnected(): boolean {
  const env = readEnv();
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
}

// Twilio error 21610: the recipient replied STOP. Twilio keeps that list
// itself, so this is how the app learns about opt-outs without a webhook.
const OPTED_OUT = 21610;

/** Sends one text through Twilio's REST API. Never throws for a per-recipient failure. */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const env = readEnv();
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) {
    throw new AppError('INVALID', 'Texting isn’t connected yet.');
  }
  const form = new URLSearchParams({ To: to, Body: body });
  // A Messaging Service (MG…) is how a registered 10DLC campaign is usually set up.
  if (env.TWILIO_FROM.startsWith('MG')) form.set('MessagingServiceSid', env.TWILIO_FROM);
  else form.set('From', env.TWILIO_FROM);
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: form,
        signal: AbortSignal.timeout(15_000)
      }
    );
    if (response.ok) return { ok: true };
    const error = (await response.json().catch(() => ({}))) as { code?: number; message?: string };
    if (response.status === 401) {
      throw new AppError(
        'INVALID',
        'Twilio refused the account details. Check the settings in Vercel.'
      );
    }
    return {
      ok: false,
      optedOut: error.code === OPTED_OUT,
      reason: error.code === OPTED_OUT ? 'opted out' : `Twilio ${error.code ?? response.status}`
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return { ok: false, optedOut: false, reason: 'could not reach Twilio' };
  }
}
