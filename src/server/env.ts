import 'server-only';

import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  OWNER_EMAIL: z.email().optional(),
  KOUTURE_DEMO_MODE: z.enum(['true', 'false']).optional(),
  NAILZY_BOOKING_URL: z.url().optional()
});

export type AppMode = 'supabase' | 'demo' | 'unconfigured';

function blankToUndefined(value: string | undefined) {
  return value && value.trim() !== '' ? value.trim() : undefined;
}

export function readEnv() {
  return envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: blankToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: blankToUndefined(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    OWNER_EMAIL: blankToUndefined(process.env.OWNER_EMAIL)?.toLowerCase(),
    KOUTURE_DEMO_MODE: blankToUndefined(process.env.KOUTURE_DEMO_MODE),
    NAILZY_BOOKING_URL: blankToUndefined(process.env.NAILZY_BOOKING_URL)
  });
}

/**
 * Supabase wins whenever it is configured. Sample-data mode only runs outside
 * production builds, so a deployed site can never fall back to it.
 */
export function getAppMode(): AppMode {
  const env = readEnv();
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.OWNER_EMAIL) {
    return 'supabase';
  }
  if (env.KOUTURE_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production') {
    return 'demo';
  }
  return 'unconfigured';
}
