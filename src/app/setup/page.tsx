import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { Monogram } from '@/components/brand/monogram';
import { envProblems, getAppMode, readEnv } from '@/server/env';

export const metadata: Metadata = { title: 'Setup required' };

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'OWNER_EMAIL'
] as const;

type PageProps = { searchParams: Promise<{ check?: string }> };

/** Explains which settings are missing or mistyped. Names only, never values. */
export default async function SetupPage({ searchParams }: PageProps) {
  await connection();
  const { check } = await searchParams;
  const problems = envProblems();
  const failedCheck = check === 'failed';
  if (getAppMode() !== 'unconfigured' && problems.length === 0 && !failedCheck) redirect('/login');

  const env = readEnv();
  const problemFor = new Map(problems.map((p) => [p.name, p.problem]));
  const rows = REQUIRED.map((name) => ({
    name,
    status: problemFor.get(name) ?? (env[name] ? 'ok' : 'missing')
  }));
  const extra = problems.filter((p) => !(REQUIRED as readonly string[]).includes(p.name));

  return (
    <main className='hero-wash grid min-h-dvh place-items-center px-4 py-10'>
      <div className='lux-card w-full max-w-lg p-8'>
        <Monogram className='size-12' />
        <h1 className='font-display mt-4 text-3xl font-medium'>Almost ready</h1>
        <p className='text-muted-foreground mt-2 text-sm'>
          Kouture Life OS needs its database connection before anyone can sign in. These settings
          live in Vercel → your project → Settings → Environment Variables (never in the code).
        </p>
        <ul className='mt-5 space-y-2'>
          {[...rows, ...extra.map((p) => ({ name: p.name, status: p.problem }))].map((row) => (
            <li key={row.name} className='bg-muted/60 rounded-xl px-4 py-3'>
              <p className='font-mono text-xs break-all'>{row.name}</p>
              <p
                className={
                  row.status === 'ok'
                    ? 'text-success mt-0.5 text-sm'
                    : 'text-destructive mt-0.5 text-sm'
                }
              >
                {row.status === 'ok'
                  ? 'Looks right'
                  : row.status === 'missing'
                    ? 'Missing'
                    : `This value ${row.status}.`}
              </p>
            </li>
          ))}
        </ul>
        {failedCheck && problems.length === 0 && (
          <p className='bg-destructive/10 text-destructive mt-4 rounded-xl px-4 py-3 text-sm'>
            The settings look right, but the app couldn’t reach Supabase with them. Check that
            NEXT_PUBLIC_SUPABASE_URL is your project’s address (ending in .supabase.co) and the key
            is that same project’s publishable / anon key.
          </p>
        )}
        <p className='text-muted-foreground mt-4 text-xs'>
          After changing a setting, redeploy: Deployments → ⋯ on the newest one → Redeploy.
        </p>
      </div>
    </main>
  );
}
