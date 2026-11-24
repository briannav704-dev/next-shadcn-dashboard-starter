import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';

import { createDemoRepositories } from '@/server/data/demo-store';
import { createSupabaseRepositories } from '@/server/data/supabase-repos';
import type { OwnerProfile, Repositories } from '@/server/data/types';
import { type AppMode, getAppMode, readEnv } from '@/server/env';
import { AppError } from '@/server/errors';
import { createSupabaseServerClient } from '@/server/supabase';

export const DEMO_SESSION_COOKIE = 'kouture_demo_session';

export type OwnerSession = {
  mode: Exclude<AppMode, 'unconfigured'>;
  profile: OwnerProfile;
  repos: Repositories;
};

/**
 * Resolves the signed-in owner, or null. Cached per request so layouts, pages
 * and actions share one lookup.
 */
export const getOwnerSession = cache(async (): Promise<OwnerSession | null> => {
  // Private pages must never be prerendered at build time.
  await connection();
  const mode = getAppMode();

  if (mode === 'demo') {
    const store = await cookies();
    if (store.get(DEMO_SESSION_COOKIE)?.value !== '1') return null;
    const repos = createDemoRepositories();
    return { mode, profile: await repos.core.getProfile(), repos };
  }

  if (mode === 'supabase') {
    const env = readEnv();
    const db = await createSupabaseServerClient();
    // getUser() verifies the JWT with Supabase rather than trusting the cookie.
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return null;
    if (data.user.email?.toLowerCase() !== env.OWNER_EMAIL) {
      await db.auth.signOut();
      return null;
    }
    const repos = createSupabaseRepositories(db, env.OWNER_EMAIL!);
    return { mode, profile: await repos.core.getProfile(), repos };
  }

  return null;
});

/** For pages: redirect to sign-in (or setup) when there is no owner session. */
export async function requireOwnerPage(): Promise<OwnerSession> {
  await connection();
  if (getAppMode() === 'unconfigured') redirect('/setup');
  const session = await getOwnerSession();
  if (!session) redirect('/login');
  return session;
}

/** For server actions: throw instead of redirecting. */
export async function requireOwnerAction(): Promise<OwnerSession> {
  const session = await getOwnerSession();
  if (!session)
    throw new AppError('UNAUTHENTICATED', 'Your session has ended. Please sign in again.');
  return session;
}

/** One instant per request, so every part of a page agrees on "now". */
export const requestNow = cache((): Date => new Date());
