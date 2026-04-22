'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';
import { useSyncExternalStore } from 'react';

// Hydration-safe mount detection using useSyncExternalStore
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useHydrated() {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const mounted = useHydrated();

  // Force light theme to prevent hydration mismatches
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {mounted ? children : null}
    </NextThemesProvider>
  );
}
