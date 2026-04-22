'use client';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { usePathname } from 'next/navigation';
import React from 'react';

export function AppBreadcrumbContent() {
  const pathname = usePathname();
  const paths = pathname.split('/').filter(Boolean);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {paths.map((path, index) => {
          const isLast = index === paths.length - 1;
          const href = `/${paths.slice(0, index + 1).join('/')}`;
          const label = path
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          return (
            <React.Fragment key={path}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
