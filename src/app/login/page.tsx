import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { Monogram } from '@/components/brand/monogram';
import { Button } from '@/components/ui/button';
import { MagicLinkForm } from '@/features/auth/components/magic-link-form';
import { startDemoSessionAction } from '@/features/auth/server/actions';
import { getAppMode } from '@/server/env';
import { getOwnerSession } from '@/server/session';

export const metadata: Metadata = { title: 'Sign in' };

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function LoginPage({ searchParams }: PageProps) {
  await connection();
  const mode = getAppMode();
  if (mode === 'unconfigured') redirect('/setup');
  if (await getOwnerSession()) redirect('/life');
  const { error } = await searchParams;

  return (
    <main className='hero-wash grid min-h-dvh place-items-center px-4 py-10'>
      <div className='lux-card w-full max-w-sm p-8 shadow-lg'>
        <div className='flex flex-col items-center text-center'>
          <Monogram className='size-16' />
          <p className='text-gold-ink mt-5 text-[0.65rem] font-medium tracking-[0.3em] uppercase'>
            Private
          </p>
          <h1 className='font-display mt-1 text-3xl font-medium tracking-wide'>Kouture Life OS</h1>
          <p className='text-muted-foreground mt-2 text-sm'>
            Your life and your salon, beautifully in one place.
          </p>
        </div>
        <div className='gold-rule my-6' />
        {error === 'link' && (
          <p
            className='text-destructive bg-destructive/10 mb-4 rounded-lg px-3 py-2 text-xs'
            role='alert'
          >
            That sign-in link was invalid or expired. Request a new one.
          </p>
        )}
        {mode === 'supabase' ? (
          <MagicLinkForm />
        ) : (
          <form action={startDemoSessionAction} className='space-y-3'>
            <p className='text-muted-foreground text-center text-xs'>
              Sample-data preview. Nothing you change here is saved, and this mode can’t run on a
              deployed site.
            </p>
            <Button type='submit' size='lg' className='h-11 w-full rounded-full'>
              Enter preview
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
