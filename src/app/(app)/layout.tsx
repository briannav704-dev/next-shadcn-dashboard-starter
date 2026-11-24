import type { CSSProperties } from 'react';
import { cookies } from 'next/headers';

import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { requireOwnerPage } from '@/server/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOwnerPage();
  const pendingApprovals = await session.repos.core.countPendingApprovals();
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get('sidebar_state')?.value;
  const defaultOpen = sidebarCookie === undefined ? true : sidebarCookie === 'true';

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className='h-dvh'
      style={{ '--sidebar-width': '15.5rem', '--sidebar-width-icon': '2.5rem' } as CSSProperties}
    >
      <a
        href='#main-content'
        className='bg-background ring-ring sr-only rounded-md px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:ring-2'
      >
        Skip to content
      </a>
      <AppSidebar pendingApprovals={pendingApprovals} ownerName={session.profile.displayName} />
      <SidebarInset
        id='main-content'
        tabIndex={-1}
        className='md:ring-foreground/5 min-h-0 min-w-0 overflow-hidden outline-none md:shadow-sm md:ring-1'
      >
        <div
          data-slot='page-scroller'
          className='flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0'
        >
          <Header pendingApprovals={pendingApprovals} mode={session.mode} />
          {children}
        </div>
      </SidebarInset>
      <MobileTabBar pendingApprovals={pendingApprovals} />
    </SidebarProvider>
  );
}
