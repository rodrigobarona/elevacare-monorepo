'use client';

import { ComponentErrorBoundary } from '@/components/shared/ComponentErrorFallback';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StripeConnectProvider } from '@/components/stripe/StripeConnectProvider';
import {
  ConnectBalances,
  ConnectPayments,
  ConnectPayoutsList,
} from '@stripe/react-connect-js';
import { toast } from 'sonner';

function FinancialTabs() {
  const handleLoadError = (section: string) => ({ error }: { error: { message?: string } }) => {
    console.error(`${section} load error:`, error);
    toast.error(`Failed to load ${section.toLowerCase()}`);
  };

  return (
    <Tabs defaultValue="balance">
      <TabsList className="w-full">
        <TabsTrigger value="balance" className="flex-1">
          Balance
        </TabsTrigger>
        <TabsTrigger value="payments" className="flex-1">
          Payments
        </TabsTrigger>
        <TabsTrigger value="payouts" className="flex-1">
          Payouts
        </TabsTrigger>
      </TabsList>

      <TabsContent value="balance" className="mt-4">
        <ConnectBalances
          onLoaderStart={() => {}}
          onLoadError={handleLoadError('Balance')}
        />
      </TabsContent>

      <TabsContent value="payments" className="mt-4">
        <ConnectPayments
          onLoaderStart={() => {}}
          onLoadError={handleLoadError('Payments')}
        />
      </TabsContent>

      <TabsContent value="payouts" className="mt-4">
        <ConnectPayoutsList
          onLoaderStart={() => {}}
          onLoadError={handleLoadError('Payouts')}
        />
      </TabsContent>
    </Tabs>
  );
}

export function StripeFinancialDashboard() {
  return (
    <ComponentErrorBoundary fallbackMessage="Could not load financial overview">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Financial Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <StripeConnectProvider>
            <FinancialTabs />
          </StripeConnectProvider>
        </CardContent>
      </Card>
    </ComponentErrorBoundary>
  );
}
