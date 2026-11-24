import Link from 'next/link';

import { Monogram } from '@/components/brand/monogram';

export default function NotFound() {
  return (
    <main className='hero-wash grid min-h-dvh place-items-center px-4'>
      <div className='text-center'>
        <Monogram className='mx-auto size-14' />
        <p className='font-display text-rose mt-6 text-7xl font-medium'>404</p>
        <h1 className='font-display mt-2 text-2xl'>This page isn’t here</h1>
        <p className='text-muted-foreground mt-2 text-sm'>
          It may be a module that arrives in a later phase.
        </p>
        <Link
          href='/life'
          className='bg-primary text-primary-foreground mt-6 inline-flex rounded-full px-5 py-2 text-sm font-medium shadow-sm'
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
