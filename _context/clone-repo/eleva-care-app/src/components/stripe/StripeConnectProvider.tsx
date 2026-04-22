'use client';

import { ComponentErrorBoundary } from '@/components/shared/ComponentErrorFallback';
import { STRIPE_CONNECT_APPEARANCE } from '@/config/stripe-appearance';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectComponentsProvider } from '@stripe/react-connect-js';
import { useState } from 'react';

export function StripeConnectProvider({ children }: { children: React.ReactNode }) {
  const [stripeConnectInstance] = useState(() =>
    loadConnectAndInitialize({
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
      fetchClientSecret: async () => {
        const response = await fetch('/api/stripe/account-session', { method: 'POST' });
        if (!response.ok) {
          const { error } = await response.json();
          throw new Error(error || 'Failed to fetch client secret');
        }
        const { client_secret } = await response.json();
        return client_secret;
      },
      appearance: STRIPE_CONNECT_APPEARANCE,
    }),
  );

  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      <ComponentErrorBoundary fallbackMessage="Could not load Stripe Connect">
        {children}
      </ComponentErrorBoundary>
    </ConnectComponentsProvider>
  );
}
