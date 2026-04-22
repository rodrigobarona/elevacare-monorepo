'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExpertEarnings } from '@/server/actions/dashboard';
import { DollarSign, TrendingUp, Clock } from 'lucide-react';

interface EarningsOverviewProps {
  earnings: ExpertEarnings;
}

function formatCurrency(amountInCents: number, currency = 'eur') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountInCents / 100);
}

export function EarningsOverview({ earnings }: EarningsOverviewProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Earnings Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Net Earnings</p>
              <p className="text-xl font-bold">
                {formatCurrency(earnings.totalNetEarnings, earnings.currency)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-secondary/10 p-2">
              <TrendingUp className="h-4 w-4 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-lg font-semibold">
                {formatCurrency(earnings.monthlyNetEarnings, earnings.currency)}
              </p>
            </div>
          </div>

          {earnings.pendingCommissions > 0 && (
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(earnings.pendingCommissions, earnings.currency)}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
