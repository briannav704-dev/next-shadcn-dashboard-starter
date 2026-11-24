'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Monogram, Wordmark } from '@/components/brand/monogram';
import { Icons } from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar
} from '@/components/ui/sidebar';
import { ENVIRONMENTS, NAV, SHARED_NAV } from '@/config/nav-config';
import { signOutAction } from '@/features/auth/server/actions';
import { useEnvironment } from '@/hooks/use-environment';
import { cn } from '@/lib/utils';
import type { Environment, NavItem } from '@/types';

const itemClass =
  'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&>svg]:text-sidebar-foreground/55 data-active:[&>svg]:text-sidebar-primary';
const railPadding = 'group-data-[collapsible=icon]:px-1';

function isActive(pathname: string, url: string) {
  if (url === '/life' || url === '/kouture') return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}

export default function AppSidebar({
  pendingApprovals,
  ownerName
}: {
  pendingApprovals: number;
  ownerName: string;
}) {
  const pathname = usePathname();
  const environment = useEnvironment();

  return (
    <Sidebar collapsible='icon' variant='inset'>
      <SidebarHeader className={cn('gap-4 pt-3', railPadding)}>
        <Link
          href={ENVIRONMENTS[environment].home}
          className='flex items-center gap-2.5 rounded-lg px-1 group-data-[collapsible=icon]:px-0'
          aria-label='Kouture Life OS home'
        >
          <Monogram className='size-9 shrink-0 group-data-[collapsible=icon]:size-7' />
          <Wordmark className='group-data-[collapsible=icon]:hidden' />
        </Link>
        <EnvironmentSwitcher active={environment} />
      </SidebarHeader>

      <SidebarContent className='overflow-x-hidden'>
        {NAV[environment].map((group) => (
          <SidebarGroup key={group.label} className={railPadding}>
            <SidebarGroupLabel className='text-gold-ink/90 text-[0.65rem] tracking-[0.18em] uppercase group-data-[collapsible=icon]:pointer-events-none'>
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu className='gap-0.5'>
              {group.items.map((item) => (
                <NavLink key={item.url} item={item} active={isActive(pathname, item.url)} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
        <SidebarGroup className={railPadding}>
          <SidebarGroupLabel className='text-gold-ink/90 text-[0.65rem] tracking-[0.18em] uppercase group-data-[collapsible=icon]:pointer-events-none'>
            {SHARED_NAV.label}
          </SidebarGroupLabel>
          <SidebarMenu className='gap-0.5'>
            {SHARED_NAV.items.map((item) => (
              <NavLink
                key={item.url}
                item={item}
                active={isActive(pathname, item.url)}
                badge={
                  item.url === '/approvals' && pendingApprovals > 0 ? pendingApprovals : undefined
                }
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={railPadding}>
        <OwnerMenu ownerName={ownerName} />
      </SidebarFooter>
      <SidebarRail className='hover:after:bg-transparent' />
    </Sidebar>
  );
}

function EnvironmentSwitcher({ active }: { active: Environment }) {
  const { setOpenMobile } = useSidebar();
  return (
    <div
      role='tablist'
      aria-label='Switch environment'
      className='bg-sidebar-accent/60 grid grid-cols-2 gap-1 rounded-full p-1 group-data-[collapsible=icon]:grid-cols-1 group-data-[collapsible=icon]:rounded-xl'
    >
      {(Object.keys(ENVIRONMENTS) as Environment[]).map((key) => {
        const env = ENVIRONMENTS[key];
        const Icon = Icons[env.icon];
        const selected = key === active;
        return (
          <Link
            key={key}
            href={env.home}
            role='tab'
            aria-selected={selected}
            title={env.label}
            onClick={() => setOpenMobile(false)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium transition-all',
              'group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:px-0',
              selected
                ? 'bg-sidebar text-sidebar-primary shadow-sm'
                : 'text-sidebar-foreground/65 hover:text-sidebar-foreground'
            )}
          >
            <Icon className='size-3.5 shrink-0' aria-hidden />
            <span className='truncate group-data-[collapsible=icon]:sr-only'>
              {key === 'life' ? 'My Life' : 'Kouture'}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function NavLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const { setOpenMobile } = useSidebar();
  const Icon = Icons[item.icon];

  if (item.comingInPhase) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={`${item.title} · arrives in Phase ${item.comingInPhase}`}
          aria-disabled
          className='text-sidebar-foreground/40 cursor-default hover:bg-transparent hover:text-sidebar-foreground/40 [&>svg]:text-sidebar-foreground/30'
        >
          <Icon />
          <span>{item.title}</span>
        </SidebarMenuButton>
        <SidebarMenuBadge className='text-sidebar-foreground/40 border-sidebar-border rounded-full border px-1.5 text-[0.6rem] font-normal tracking-wide uppercase'>
          Soon
        </SidebarMenuBadge>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          <Link
            href={item.url}
            aria-label={item.title}
            aria-current={active ? 'page' : undefined}
          />
        }
        tooltip={item.title}
        isActive={active}
        className={itemClass}
        onClick={() => setOpenMobile(false)}
      >
        <Icon />
        <span>{item.title}</span>
      </SidebarMenuButton>
      {badge !== undefined && (
        <SidebarMenuBadge className='bg-primary text-primary-foreground rounded-full px-1.5 text-[0.65rem]'>
          {badge}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

function OwnerMenu({ ownerName }: { ownerName: string }) {
  const { isMobile, state } = useSidebar();
  const initial = ownerName.trim().charAt(0).toUpperCase() || 'K';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size='lg'
                className='data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground'
              />
            }
          >
            <span className='bg-blush text-rose font-display grid size-8 shrink-0 place-items-center rounded-full text-base'>
              {initial}
            </span>
            <span className='grid min-w-0 flex-1 text-left leading-tight'>
              <span className='truncate text-sm font-medium'>{ownerName}</span>
              <span className='text-muted-foreground truncate text-xs'>Owner</span>
            </span>
            <Icons.chevronsUpDown className='text-muted-foreground ml-auto size-4' />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className={isMobile ? 'w-(--anchor-width) min-w-56' : 'w-56'}
            side={isMobile ? 'top' : 'right'}
            align='end'
            sideOffset={state === 'collapsed' && !isMobile ? 16 : 8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className='text-muted-foreground text-xs font-normal'>
                Signed in as owner
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href='/activity' aria-label='Activity log' />}>
                <Icons.history />
                Activity log
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void signOutAction()}>
                <Icons.logout aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
