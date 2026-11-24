'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icons } from '@/components/icons';
import { useSidebar } from '@/components/ui/sidebar';
import { ENVIRONMENTS } from '@/config/nav-config';
import { useEnvironment } from '@/hooks/use-environment';
import { cn } from '@/lib/utils';

/** Thumb-reach navigation for phones; hidden from md (iPad portrait) up. */
export function MobileTabBar({ pendingApprovals }: { pendingApprovals: number }) {
  const pathname = usePathname();
  const environment = useEnvironment();
  const { setOpenMobile } = useSidebar();
  const other = environment === 'life' ? 'kouture' : 'life';

  const tabs = [
    {
      href: ENVIRONMENTS.life.home,
      label: 'My Life',
      icon: Icons.heart,
      active: pathname.startsWith('/life')
    },
    {
      href: ENVIRONMENTS.kouture.home,
      label: 'Kouture',
      icon: Icons.diamond,
      active: pathname.startsWith('/kouture')
    },
    {
      href: '/approvals',
      label: 'Approvals',
      icon: Icons.approvals,
      active: pathname.startsWith('/approvals'),
      badge: pendingApprovals
    }
  ];

  return (
    <nav
      aria-label='Primary'
      className='bg-background/90 fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden'
    >
      <ul className='grid grid-cols-4'>
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.active ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center gap-0.5 py-2 text-[0.65rem] font-medium',
                tab.active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <tab.icon className='size-5' aria-hidden />
              {tab.label}
              {tab.badge ? (
                <span className='bg-primary text-primary-foreground absolute top-1 left-[calc(50%+6px)] min-w-4 rounded-full px-1 text-center text-[0.6rem] leading-4'>
                  {tab.badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
        <li>
          <button
            type='button'
            onClick={() => setOpenMobile(true)}
            className='text-muted-foreground flex w-full flex-col items-center gap-0.5 py-2 text-[0.65rem] font-medium'
            aria-label={`Open ${ENVIRONMENTS[environment].label} menu`}
          >
            <Icons.menu className='size-5' aria-hidden />
            Menu
          </button>
        </li>
      </ul>
      <span className='sr-only'>Switch to {ENVIRONMENTS[other].label} using the tabs above.</span>
    </nav>
  );
}
