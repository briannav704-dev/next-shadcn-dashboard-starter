import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { readEnv } from '@/server/env';
import { AppError } from '@/server/errors';

/**
 * Supabase client bound to the signed-in owner's session cookie. It uses the
 * public anon key, so every query runs under Row Level Security as the owner.
 * The service-role key is deliberately never used by page or action code.
 */
export async function createSupabaseServerClient() {
  const env = readEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new AppError('UNAUTHENTICATED', 'Supabase is not configured.');
  }
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // proxy refreshes the session on the next request instead.
        }
      }
    }
  });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
