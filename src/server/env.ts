import 'server-only';

import { z } from 'zod';

// Each setting is checked on its own: a mistyped value is reported on /setup
// (by name, never by value) instead of crashing every page.
const fields = {
  NEXT_PUBLIC_SUPABASE_URL: z
    .url('must be a full web address')
    .refine((v) => v.startsWith('https://'), 'must start with https://')
    .transform((v) => v.replace(/\/+$/, '')),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, 'looks too short; copy the whole key')
    .refine((v) => !/\s/.test(v), 'contains a space or line break')
    .refine(
      (v) => !isSecretKey(v),
      'is the SECRET key. Use the publishable / anon key instead, and keep the secret one private'
    ),
  OWNER_EMAIL: z.email('must be a single email address'),
  KOUTURE_DEMO_MODE: z.enum(['true', 'false']),
  NAILZY_BOOKING_URL: z.url('must be a full web address'),
  /** Secret iCal address of the calendar Nailzy syncs bookings into. Never commit it. */
  NAILZY_CALENDAR_URL: z
    .string()
    .regex(/^(https|webcal):\/\/\S+$/i, 'must be the https or webcal calendar address'),
  // Optional texting through Twilio. Secrets: set in Vercel only.
  TWILIO_ACCOUNT_SID: z
    .string()
    .regex(/^AC[0-9a-f]{32}$/i, 'must be the Account SID (starts with AC)'),
  TWILIO_AUTH_TOKEN: z.string().regex(/^[0-9a-f]{32}$/i, 'must be the 32-character Auth Token'),
  TWILIO_FROM: z
    .string()
    .regex(
      /^(\+1\d{10}|MG[0-9a-f]{32})$/i,
      'must be your Twilio number (+1…) or Messaging Service SID (MG…)'
    )
} as const;

type FieldName = keyof typeof fields;
type Env = { [K in FieldName]?: z.output<(typeof fields)[K]> };

/** Supabase secret keys: the new `sb_secret_` format, or a legacy JWT whose role is service_role. */
function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
    };
    return json.role === 'service_role';
  } catch {
    return false;
  }
}

export type AppMode = 'supabase' | 'demo' | 'unconfigured';
export type EnvProblem = { name: FieldName; problem: string };

function raw(name: FieldName): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  return name === 'OWNER_EMAIL' ? value.toLowerCase() : value;
}

function parse(): { env: Env; problems: EnvProblem[] } {
  const env: Env = {};
  const problems: EnvProblem[] = [];
  for (const name of Object.keys(fields) as FieldName[]) {
    const value = raw(name);
    if (value === undefined) continue;
    const result = fields[name].safeParse(value);
    if (result.success) (env as Record<string, unknown>)[name] = result.data;
    else problems.push({ name, problem: result.error.issues[0]?.message ?? 'is not valid' });
  }
  return { env, problems };
}

export function readEnv(): Env {
  return parse().env;
}

/** Settings that are present but unusable. Names and reasons only, never values. */
export function envProblems(): EnvProblem[] {
  return parse().problems;
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
