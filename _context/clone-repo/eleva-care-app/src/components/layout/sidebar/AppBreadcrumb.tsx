import { Breadcrumb, BreadcrumbList } from '@/components/ui/breadcrumb';
import { Suspense } from 'react';

import { AppBreadcrumbContent } from './AppBreadcrumbContent';

function AppBreadcrumbSkeleton() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function AppBreadcrumb() {
  return (
    <Suspense fallback={<AppBreadcrumbSkeleton />}>
      <AppBreadcrumbContent />
    </Suspense>
  );
}
