'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Shell({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('container relative', className)} {...props}>
      <div className="space-y-6 pb-16">{children}</div>
    </div>
  );
}
