'use client';

import { useSmoothNavigation } from '@/hooks/useSmoothNavigation';
import { Link } from '@/lib/i18n/navigation';
import { type ComponentProps } from 'react';

interface SmoothLinkProps extends Omit<ComponentProps<typeof Link>, 'onClick' | 'href'> {
  href: string;
  children: React.ReactNode;
}

export default function SmoothLink({ href, children, ...props }: SmoothLinkProps) {
  const { navigateWithHash } = useSmoothNavigation();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigateWithHash(href);
  };

  return (
    <Link
      // @ts-expect-error - Allow flexible href for hash navigation
      href={href}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  );
}
