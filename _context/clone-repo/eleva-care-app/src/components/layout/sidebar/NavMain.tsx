import type { LucideIcon } from 'lucide-react';
import { Suspense } from 'react';

import { NavMainContent } from './NavMainContent';
import { SidebarGroup, SidebarGroupLabel } from './sidebar';

interface NavMainProps {
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

function NavMainSkeleton() {
  return (
    <div className="relative overflow-hidden">
      <SidebarGroup>
        <SidebarGroupLabel>Loading...</SidebarGroupLabel>
      </SidebarGroup>
    </div>
  );
}

export function NavMain({ items }: NavMainProps) {
  return (
    <Suspense fallback={<NavMainSkeleton />}>
      <NavMainContent items={items} />
    </Suspense>
  );
}
