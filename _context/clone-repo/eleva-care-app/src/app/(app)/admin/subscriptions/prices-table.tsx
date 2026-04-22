'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCommissionRate, formatCurrency } from '@/lib/validations/stripe-pricing';
import {
  activateStripePrice,
  archiveStripePrice,
  listStripePrices,
} from '@/server/actions/stripe-pricing';
import { AlertCircle, Archive, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type Stripe from 'stripe';

interface PricesTableProps {
  productId: string;
}

export function PricesTable({ productId }: PricesTableProps) {
  const [prices, setPrices] = useState<Stripe.Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadPrices = async () => {
    setLoading(true);
    setError(null);

    const result = await listStripePrices({ productId, limit: 100 });

    if (result.success) {
      setPrices(result.data || []);
    } else {
      setError(result.error || 'Failed to load prices');
    }

    setLoading(false);
  };

  useEffect(() => {
    loadPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleArchive = async (priceId: string) => {
    setActionLoading(priceId);
    const result = await archiveStripePrice(priceId);

    if (result.success) {
      toast.success(result.message);
      await loadPrices();
    } else {
      toast.error(result.error || 'Failed to archive price');
    }

    setActionLoading(null);
  };

  const handleActivate = async (priceId: string) => {
    setActionLoading(priceId);
    const result = await activateStripePrice(priceId);

    if (result.success) {
      toast.success(result.message);
      await loadPrices();
    } else {
      toast.error(result.error || 'Failed to activate price');
    }

    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={loadPrices} className="ml-auto">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (prices.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No prices found for this product. Click "Add Price" to create one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Prices ({prices.length})</h3>
        <Button variant="ghost" size="sm" onClick={loadPrices}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nickname</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead>Metadata</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((price) => (
              <TableRow key={price.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{price.nickname || '—'}</p>
                    <p className="text-xs text-muted-foreground">{price.id}</p>
                  </div>
                </TableCell>
                <TableCell>{formatCurrency(price.unit_amount || 0, price.currency)}</TableCell>
                <TableCell>
                  {price.recurring ? (
                    <Badge variant="secondary">
                      {price.recurring.interval_count > 1
                        ? `Every ${price.recurring.interval_count} ${price.recurring.interval}s`
                        : `${price.recurring.interval}ly`}
                    </Badge>
                  ) : (
                    <Badge variant="outline">One-time</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {price.metadata.tier && (
                      <Badge variant="outline" className="w-fit">
                        {price.metadata.tier}
                      </Badge>
                    )}
                    {price.metadata.planType && (
                      <Badge variant="outline" className="w-fit">
                        {price.metadata.planType}
                      </Badge>
                    )}
                    {price.metadata.commissionRate && (
                      <span className="text-xs text-muted-foreground">
                        Commission: {formatCommissionRate(Number(price.metadata.commissionRate))}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {price.active ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <Archive className="h-3 w-3" />
                      Archived
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {price.active ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchive(price.id)}
                      disabled={actionLoading === price.id}
                    >
                      {actionLoading === price.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleActivate(price.id)}
                      disabled={actionLoading === price.id}
                    >
                      {actionLoading === price.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Activate
                        </>
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
