'use client';

import { useRouter } from 'next/navigation';

/**
 * A hook that provides a function to revalidate paths client-side
 */
export function useRevalidation() {
  const router = useRouter();

  const revalidate = () => {
    // This will revalidate data and refresh the UI
    router.refresh();
  };

  return revalidate;
}
