// Mock for next-intl/navigation - Vitest compatible
import type { Mock } from 'vitest';
import { vi } from 'vitest';

interface RouterMock {
  push: Mock<() => void>;
  replace: Mock<() => void>;
  back: Mock<() => void>;
  forward: Mock<() => void>;
  refresh: Mock<() => void>;
  prefetch: Mock<() => void>;
}

export const createNavigation = vi.fn((_routing: unknown) => ({
  Link: vi.fn(({ children }: { children: React.ReactNode }) => children),
  redirect: vi.fn((_href: string) => undefined),
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(
    (): RouterMock => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }),
  ),
  getPathname: vi.fn(() => '/'),
  permanentRedirect: vi.fn((_href: string) => undefined),
}));

// Export default createNavigation
const navigationMock = { createNavigation };
export default navigationMock;
