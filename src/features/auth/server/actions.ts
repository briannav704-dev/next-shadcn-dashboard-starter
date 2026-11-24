'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { type ActionResult, runAction } from '@/server/action-result';
import { getAppMode, readEnv } from '@/server/env';
import { AppError } from '@/server/errors';
import { DEMO_SESSION_COOKIE } from '@/server/session';
import { createSupabaseServerClient } from '@/server/supabase';

const signInSchema = z.object({
  email: z.email('Enter a valid email address.').transform((v) => v.trim().toLowerCase())
});

/** Emails a one-time sign-in link. Only the configured owner email is accepted. */
export async function requestMagicLinkAction(input: { email: string }): Promise<ActionResult> {
  return runAction(signInSchema, input, async ({ email }) => {
    if (getAppMode() !== 'supabase')
      throw new AppError('INVALID', 'Email sign-in is not set up yet.');
    const env = readEnv();
    // Same response whether or not the email matches, so the form can't be used
    // to discover the owner's address.
    if (email !== env.OWNER_EMAIL) return undefined;
    const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? '';
    const db = await createSupabaseServerClient();
    const { error } = await db.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` }
    });
    if (error) throw new AppError('UPSTREAM', 'Could not send the sign-in email', { cause: error });
    return undefined;
  });
}

export async function startDemoSessionAction(): Promise<void> {
  if (getAppMode() !== 'demo') throw new AppError('FORBIDDEN', 'Sample mode is disabled.');
  const store = await cookies();
  store.set(DEMO_SESSION_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12
  });
  redirect('/life');
}

export async function signOutAction(): Promise<void> {
  const mode = getAppMode();
  if (mode === 'supabase') {
    const db = await createSupabaseServerClient();
    await db.auth.signOut();
  }
  (await cookies()).delete(DEMO_SESSION_COOKIE);
  redirect('/login');
}
