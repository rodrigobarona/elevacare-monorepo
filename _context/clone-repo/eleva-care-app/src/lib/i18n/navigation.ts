import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

// Create the navigation utilities for client and server components
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
