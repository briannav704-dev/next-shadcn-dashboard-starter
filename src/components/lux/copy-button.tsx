'use client';

import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Couldn’t copy. Select the text and copy it instead.');
    }
  }
  return (
    <Button variant='ghost' size='sm' className='rounded-full' onClick={copy}>
      <Icons.page />
      {label}
    </Button>
  );
}
