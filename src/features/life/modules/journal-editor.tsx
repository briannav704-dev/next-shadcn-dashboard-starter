'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { upsertEntityAction } from '@/features/entities/server/actions';
import { cn } from '@/lib/utils';

import { MOODS } from '../forms';

const field =
  'border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 w-full rounded-xl border px-3 py-2 text-base outline-none focus-visible:ring-3 md:text-sm';

export function JournalEditor({
  day,
  initial
}: {
  day: string;
  initial: {
    mood: number | null;
    title: string | null;
    body: string | null;
    gratitude: string | null;
  } | null;
}) {
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [gratitude, setGratitude] = useState(initial?.gratitude ?? '');
  const [pending, startTransition] = useTransition();

  return (
    <form
      className='space-y-5'
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await upsertEntityAction({
            entity: 'life.journal_entries',
            values: {
              entryOn: day,
              mood,
              title: title || null,
              body: body || null,
              gratitude: gratitude || null
            }
          });
          if (result.ok) toast.success('Saved to your journal');
          else toast.error(result.error);
        });
      }}
    >
      <fieldset>
        <legend className='text-sm font-medium'>How are you feeling?</legend>
        <div className='mt-2 grid grid-cols-5 gap-2'>
          {MOODS.map((m) => (
            <button
              key={m.value}
              type='button'
              aria-pressed={mood === m.value}
              onClick={() => setMood(mood === m.value ? null : m.value)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-xs transition-colors',
                mood === m.value
                  ? 'border-rose bg-blush text-foreground'
                  : 'border-border text-muted-foreground hover:border-rose/50'
              )}
            >
              <span className='flex gap-0.5' aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={cn('size-1.5 rounded-full', i < m.value ? 'bg-rose' : 'bg-blush')}
                  />
                ))}
              </span>
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className='space-y-1.5'>
        <label htmlFor='journal-title' className='text-sm font-medium'>
          Title
        </label>
        <input
          id='journal-title'
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          className={cn(field, 'h-11 font-display text-lg md:text-lg')}
        />
      </div>
      <div className='space-y-1.5'>
        <label htmlFor='journal-body' className='text-sm font-medium'>
          Today
        </label>
        <textarea
          id='journal-body'
          rows={9}
          value={body}
          maxLength={20000}
          placeholder='What happened, what you felt, what you learned…'
          onChange={(e) => setBody(e.target.value)}
          className={cn(field, 'leading-relaxed')}
        />
      </div>
      <div className='space-y-1.5'>
        <label htmlFor='journal-gratitude' className='text-sm font-medium'>
          Grateful for
        </label>
        <input
          id='journal-gratitude'
          value={gratitude}
          maxLength={2000}
          onChange={(e) => setGratitude(e.target.value)}
          className={cn(field, 'h-11')}
        />
      </div>
      <div className='flex items-center justify-between gap-3'>
        <p className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          <Icons.lock className='size-3.5' aria-hidden /> Private. The activity log records that you
          wrote, never what.
        </p>
        <Button type='submit' size='lg' className='rounded-full px-6' disabled={pending}>
          {pending && <Icons.spinner className='animate-spin' />}
          Save entry
        </Button>
      </div>
    </form>
  );
}
