'use client';

import { NavMain } from '@/components/layout/sidebar/NavMain';
import { NavSecondary } from '@/components/layout/sidebar/NavSecondary';
import { NavUser } from '@/components/layout/sidebar/NavUser';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/layout/sidebar/sidebar';
import { useIsExpert } from '@/components/shared/providers/AuthorizationProvider';
import { useUsername } from '@/hooks/use-user-profile';
import { Bell, Calendar, ExternalLink, Leaf, LifeBuoy, type LucideIcon, User } from 'lucide-react';
import { Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

interface SidebarItem {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: {
    title: string;
    url: string;
  }[];
}

const mainItems: SidebarItem[] = [
  {
    title: 'Events',
    url: '/booking/events',
    icon: LinkIcon,
    items: [
      { title: 'All Events', url: '/booking/events' },
      { title: 'Create Event', url: '/booking/events/new' },
    ],
  },
  {
    title: 'Calendar ',
    url: '/booking/schedule',
    icon: Calendar,
    items: [
      { title: 'Weekly hours', url: '/booking/schedule#weekly-hours' },
      { title: 'Time zone', url: '/booking/schedule#timezone' },
      { title: 'Blocked dates', url: '/booking/schedule#blocked-dates' },
      { title: 'Buffer Times', url: '/booking/schedule/limits#buffer-times' },
      { title: 'Booking Rules', url: '/booking/schedule/limits#booking-rules' },
      { title: 'Booking Window', url: '/booking/schedule/limits#booking-window' },
    ],
  },

  {
    title: 'Expert Profile',
    url: '/booking/expert',
    icon: User,
  },
];

export function AppSidebar() {
  const isExpert = useIsExpert();
  const { username } = useUsername(); // Centralized hook with caching

  // Build secondary items conditionally
  const secondaryItems: SidebarItem[] = [
    {
      title: 'Notifications',
      url: '/account/notifications',
      icon: Bell,
    },
    // Only include Public Expert Profile if user has the required role
    ...(isExpert && username
      ? [
          {
            title: 'Public Expert Profile',
            url: `/${username}`,
            icon: ExternalLink,
          },
        ]
      : []),
    {
      title: 'Need help?',
      url: 'mailto:patimota@gmail.com',
      icon: LifeBuoy,
    },
  ];

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarInset>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-eleva-primary text-white">
                    <Leaf className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Eleva Care</span>
                    <span className="truncate text-xs">Professional</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={mainItems} />
          <NavSecondary items={secondaryItems} className="mt-auto" />
        </SidebarContent>
        <SidebarFooter>
          <Suspense fallback={<NavUser.Skeleton />}>
            <NavUser />
          </Suspense>
        </SidebarFooter>
      </SidebarInset>
    </Sidebar>
  );
}
