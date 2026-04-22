import Link from 'next/link';
import { type ComponentProps, Suspense } from 'react';

import { NavLinkContent } from './NavLinkContent';

export function NavLink(props: ComponentProps<typeof Link>) {
  return (
    <Suspense fallback={<Link {...props} className="text-muted-foreground transition-colors" />}>
      <NavLinkContent {...props} />
    </Suspense>
  );
}
