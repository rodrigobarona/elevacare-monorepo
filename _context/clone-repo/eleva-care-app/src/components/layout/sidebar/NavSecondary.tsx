'use client';

import type * as React from 'react';
import { EnhancedNotificationBell } from '@/components/integrations/novu/SecureNovuInbox';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/layout/sidebar/sidebar';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface NavSecondaryProps extends React.ComponentPropsWithoutRef<typeof SidebarGroup> {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
  }[];
}

export function NavSecondary({ items, ...props }: NavSecondaryProps) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.title === 'Notifications' ? (
                <EnhancedNotificationBell showDropdown={true} />
              ) : (
                <SidebarMenuButton asChild size="sm">
                  <Link href={item.url} prefetch>
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
