import Link from 'next/link';

import { Monogram } from '@/components/brand/monogram';
import { Icons } from '@/components/icons';
import { ThemeModeToggle } from '@/components/themes/theme-mode-toggle';
import { Button } from '@/components/ui/button';

import { SidebarToggle } from './sidebar-toggle';

export default function Header({
  pendingApprovals,
  mode
}: {
  pendingApprovals: number;
  mode: 'demo' | 'supabase';
}) {
  return (
    <header className='bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b px-3 backdrop-blur-md md:px-5'>
      <div className='flex min-w-0 flex-1 items-center gap-2'>
        <SidebarToggle />
        <Monogram className='size-7 md:hidden' />
        {mode === 'demo' && (
          <span className='border-champagne/60 text-gold-ink hidden rounded-full border px-2.5 py-0.5 text-[0.65rem] font-medium tracking-[0.16em] uppercase sm:inline'>
            Sample data
          </span>
        )}
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        <Button
          variant='ghost'
          size='icon'
          className='text-muted-foreground hover:text-foreground relative'
          nativeButton={false}
          render={<Link href='/approvals' aria-label={`Approvals, ${pendingApprovals} waiting`} />}
        >
          <Icons.approvals />
          {pendingApprovals > 0 && (
            <span className='bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[0.6rem] leading-4 font-semibold'>
              {pendingApprovals}
            </span>
          )}
        </Button>
        <ThemeModeToggle />
      </div>
    </header>
  );
}
