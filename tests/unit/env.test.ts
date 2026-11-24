import { afterEach, describe, expect, it, vi } from 'vitest';

import { envProblems, getAppMode, readEnv } from '@/server/env';

const jwt = (role: string) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signaturesignature`;

function setEnv(values: Record<string, string>) {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', values.url ?? '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', values.key ?? '');
  vi.stubEnv('OWNER_EMAIL', values.email ?? '');
  vi.stubEnv('KOUTURE_DEMO_MODE', '');
}

afterEach(() => vi.unstubAllEnvs());

describe('environment settings', () => {
  it('accepts a correct setup, tidying spaces, case and trailing slashes', () => {
    setEnv({ url: ' https://abc.supabase.co/ ', key: jwt('anon'), email: ' Owner@Example.com ' });
    expect(envProblems()).toEqual([]);
    expect(getAppMode()).toBe('supabase');
    expect(readEnv()).toMatchObject({
      NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
      OWNER_EMAIL: 'owner@example.com'
    });
  });

  it('reports mistyped values by name instead of crashing', () => {
    setEnv({
      url: 'abc.supabase.co',
      key: 'sb_publishable_abcdefghijklmnop',
      email: 'me@x.com, you@y.com'
    });
    expect(envProblems().map((p) => p.name)).toEqual(['NEXT_PUBLIC_SUPABASE_URL', 'OWNER_EMAIL']);
    expect(getAppMode()).toBe('unconfigured');
  });

  it('refuses the secret service key in either format', () => {
    for (const key of [jwt('service_role'), 'sb_secret_abcdefghijklmnopqrstuv']) {
      setEnv({ url: 'https://abc.supabase.co', key, email: 'o@example.com' });
      expect(envProblems()).toEqual([
        { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', problem: expect.stringContaining('SECRET') }
      ]);
      expect(getAppMode()).toBe('unconfigured');
    }
  });
});
