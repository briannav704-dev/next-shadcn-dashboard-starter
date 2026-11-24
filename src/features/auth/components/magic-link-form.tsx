'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { requestMagicLinkAction, verifySignInCodeAction } from '../server/actions';

export function MagicLinkForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <form
        className='space-y-3'
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await verifySignInCodeAction({ email, code });
            if (result.ok) {
              router.replace('/life');
              router.refresh();
            } else setError(result.error);
          });
        }}
      >
        <div className='bg-blush/60 rounded-xl p-4 text-center text-sm' role='status'>
          <Icons.mail className='text-rose mx-auto mb-2 size-6' aria-hidden />
          If that’s the owner email, a sign-in email is on its way. Type the code from it below, or
          tap its link.
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor='code'>Code from the email</Label>
          <Input
            id='code'
            inputMode='numeric'
            autoComplete='one-time-code'
            pattern='[0-9 ]*'
            maxLength={12}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className='h-11 rounded-xl text-center text-lg tracking-[0.3em]'
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'code-error' : undefined}
          />
          {error && (
            <p id='code-error' className='text-destructive text-xs'>
              {error}
            </p>
          )}
        </div>
        <Button type='submit' size='lg' className='h-11 w-full rounded-full' disabled={pending}>
          {pending && <Icons.spinner className='animate-spin' />}
          Sign in
        </Button>
        <button
          type='button'
          className='text-muted-foreground hover:text-foreground w-full text-center text-xs underline-offset-4 hover:underline'
          onClick={() => {
            setSent(false);
            setCode('');
            setError(null);
          }}
        >
          Use a different email or send a new code
        </button>
      </form>
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
        Email me a sign-in code
      </Button>
      <p className='text-muted-foreground text-center text-xs'>
        No password. You stay signed in on this device until you sign out.
      </p>
    </form>
  );
}
