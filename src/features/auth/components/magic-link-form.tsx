'use client';

import { useState, useTransition } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { requestMagicLinkAction } from '../server/actions';

export function MagicLinkForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <div className='bg-blush/60 rounded-xl p-4 text-center text-sm' role='status'>
        <Icons.mail className='text-rose mx-auto mb-2 size-6' aria-hidden />
        If that’s the owner email, a sign-in link is on its way. It expires in one hour.
      </div>
    );
  }

  return (
    <form
      className='space-y-3'
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await requestMagicLinkAction({ email });
          if (result.ok) setSent(true);
          else setError(result.error);
        });
      }}
    >
      <div className='space-y-1.5'>
        <Label htmlFor='email'>Email</Label>
        <Input
          id='email'
          type='email'
          autoComplete='email'
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className='h-11 rounded-xl'
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'email-error' : undefined}
        />
        {error && (
          <p id='email-error' className='text-destructive text-xs'>
            {error}
          </p>
        )}
      </div>
      <Button type='submit' size='lg' className='h-11 w-full rounded-full' disabled={pending}>
        {pending ? <Icons.spinner className='animate-spin' /> : <Icons.mail />}
        Email me a sign-in link
      </Button>
    </form>
  );
}
