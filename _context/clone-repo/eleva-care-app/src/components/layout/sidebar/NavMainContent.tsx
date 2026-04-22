'use client';

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/layout/sidebar/sidebar';
import { RequireRole } from '@/components/shared/providers/AuthorizationProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { WORKOS_ROLES } from '@/types/workos-rbac';
import {
  Calendar,
  CheckSquare,
  ChevronLeft,
  FileText,
  Home,
  type LucideIcon,
  MoreHorizontal,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavMainContentProps {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}

export function NavMainContent({ items }: NavMainContentProps) {
  const { isMobile } = useSidebar();
  const pathname = usePathname();
  const isAccountSection = pathname.startsWith('/account') || pathname.startsWith('/admin');

  return (
    <div className="relative h-full overflow-hidden">
      <div
        className={cn(
          'transition-transform duration-300 ease-in-out',
          isAccountSection ? '-translate-x-full' : 'translate-x-0',
        )}
      >
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/dashboard">
                  <Home className="size-4" />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <RequireRole roles={['expert_community', 'expert_top']}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/setup">
                    <CheckSquare className="size-4" />
                    <span>Setup Guide</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </RequireRole>
          </SidebarMenu>
        </SidebarGroup>
        {/* Expert section */}
        <RequireRole roles={['expert_community', 'expert_top']}>
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Appointments</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/appointments'}>
                    <Link href="/appointments" prefetch>
                      <Calendar className="size-4" />
                      <span>Bookings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/appointments/records'}>
                    <Link href="/appointments/records" prefetch>
                      <FileText className="size-4" />
                      <span>Records & Notes</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/appointments/patients'}>
                    <Link href="/appointments/patients" prefetch>
                      <Users className="size-4" />
                      <span>Clients</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Booking</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname === item.url}>
                      <Link href={item.url} prefetch>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.items && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuAction showOnHover>
                            <MoreHorizontal />
                            <span className="sr-only">More</span>
                          </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          className="w-48"
                          side={isMobile ? 'bottom' : 'right'}
                          align={isMobile ? 'end' : 'start'}
                        >
                          {item.items.map((subItem) => (
                            <DropdownMenuItem key={subItem.title} asChild>
                              <Link href={subItem.url}>{subItem.title}</Link>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </>
        </RequireRole>
      </div>

      <div
        className={cn(
          'absolute inset-0 transition-transform duration-300 ease-in-out',
          isAccountSection ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Back to dashboard section */}
        <SidebarGroup>
          <SidebarGroupLabel>
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="hover:text-foreground/80">
                <ChevronLeft className="size-4" />
                <span>Dashboard</span>
              </Link>
            </div>
          </SidebarGroupLabel>
        </SidebarGroup>

        {/* Account settings section */}
        <SidebarGroup>
          <SidebarGroupLabel>Account Settings</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/account'}>
                <Link href="/account">
                  <span>Personal Information</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/account/security'}>
                <Link href="/account/security">
                  <span>Security</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/account/notifications'}>
                <Link href="/account/notifications">
                  <span>My Notifications</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Billing and identity section */}
            <RequireRole roles={['expert_community', 'expert_top']}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/account/billing'}>
                  <Link href="/account/billing">
                    <span>Billing</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/account/identity'}>
                  <Link href="/account/identity">
                    <span>Identity</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </RequireRole>
          </SidebarMenu>
        </SidebarGroup>

        {/* Admin section */}
        <RequireRole roles={WORKOS_ROLES.SUPERADMIN}>
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/admin/users'}>
                  <Link href="/admin/users">
                    <span>Users</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/admin/categories'}>
                  <Link href="/admin/categories">
                    <span>Expert categories</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/admin/payments'}>
                  <Link href="/admin/payments">
                    <span>Manage payments</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </RequireRole>
      </div>
    </div>
  );
}
