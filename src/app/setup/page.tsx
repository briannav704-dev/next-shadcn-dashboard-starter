import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { Monogram } from '@/components/brand/monogram';
import { getAppMode } from '@/server/env';

export const metadata: Metadata = { title: 'Setup required' };

/** Shown when neither Supabase nor local sample mode is configured. Reveals no secrets. */
export default async function SetupPage() {
  await connection();
  if (getAppMode() !== 'unconfigured') redirect('/login');
  return (
    <main className='hero-wash grid min-h-dvh place-items-center px-4 py-10'>
      <div className='lux-card w-full max-w-lg p-8'>
        <Monogram className='size-12' />
        <h1 className='font-display mt-4 text-3xl font-medium'>Almost ready</h1>
        <p className='text-muted-foreground mt-2 text-sm'>
          Kouture Life OS needs its database connection before anyone can sign in. Add these
          environment variables in your hosting settings (never in the code):
        </p>
        <ul className='bg-muted/60 mt-4 space-y-1 rounded-xl p-4 font-mono text-xs'>
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
          <li>OWNER_EMAIL</li>
        </ul>
        <p className='text-muted-foreground mt-4 text-xs'>
          For a local preview with sample data, set KOUTURE_DEMO_MODE=true in .env.local. See
          docs/SETUP.md.
        </p>
      </div>
    </main>
  );
}
