'use client';

import { ComponentErrorBoundary } from '@/components/shared/ComponentErrorFallback';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { checkAnnualEligibility, type EligibilityStatus } from '@/server/actions/eligibility';
import {
  cancelSubscription,
  createSubscription,
  getSubscriptionStatus,
  reactivateSubscription,
  type SubscriptionInfo,
} from '@/server/actions/subscriptions';
import { Calendar, CheckCircle2, CreditCard, TrendingUp, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

function SubscriptionDashboardInner() {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  async function loadSubscriptionData() {
    try {
      setLoading(true);
      const [subData, eligData] = await Promise.all([
        getSubscriptionStatus(),
        checkAnnualEligibility(''), // Empty string = current user
      ]);
      setSubscription(subData);
      setEligibility(eligData);
    } catch (error) {
      console.error('Error loading subscription data:', error);
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade() {
    if (!eligibility || !subscription) return;

    setActionLoading(true);
    try {
      // Use lookup keys instead of hardcoded price IDs
      const { EXPERT_LOOKUP_KEYS } = await import('@/config/subscription-lookup-keys');
      const lookupKey = EXPERT_LOOKUP_KEYS[eligibility.tierLevel].annual;

      const result = await createSubscription(lookupKey, eligibility.tierLevel);

      if (result.success && result.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = result.checkoutUrl;
      } else {
        toast.error(result.error || 'Failed to create subscription');
      }
    } catch (error) {
      console.error('Error upgrading:', error);
      toast.error('Failed to start upgrade process');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    try {
      const result = await cancelSubscription('user_requested');
      if (result.success) {
        toast.success('Subscription will be canceled at the end of the current period');
        await loadSubscriptionData();
      } else {
        toast.error(result.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error canceling:', error);
      toast.error('Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate() {
    setActionLoading(true);
    try {
      const result = await reactivateSubscription();
      if (result.success) {
        toast.success('Subscription reactivated successfully');
        await loadSubscriptionData();
      } else {
        toast.error(result.error || 'Failed to reactivate subscription');
      }
    } catch (error) {
      console.error('Error reactivating:', error);
      toast.error('Failed to reactivate subscription');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <Alert>
        <XCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load subscription data</AlertDescription>
      </Alert>
    );
  }

  const isAnnualPlan = subscription.planType === 'annual';
  const isActive = subscription.status === 'active';
  const isPastDue = subscription.status === 'past_due';
  const isCanceled = subscription.status === 'canceled' || subscription.cancelAtPeriodEnd;

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your subscription and commission details</CardDescription>
            </div>
            <Badge
              variant={
                isActive
                  ? 'default'
                  : isPastDue
                    ? 'destructive'
                    : isCanceled
                      ? 'secondary'
                      : 'outline'
              }
            >
              {isActive && !isCanceled
                ? 'Active'
                : isCanceled
                  ? 'Canceling'
                  : isPastDue
                    ? 'Past Due'
                    : subscription.status || 'Commission-Based'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Plan Type</div>
              <div className="mt-1 text-2xl font-bold">
                {isAnnualPlan ? 'Annual Subscription' : 'Commission-Based'}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {subscription.tierLevel === 'top' ? 'Top Expert' : 'Community Expert'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Commission Rate</div>
              <div className="mt-1 text-2xl font-bold">
                {(subscription.commissionRate * 100).toFixed(0)}%
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Per booking</div>
            </div>
            {isAnnualPlan && subscription.annualFee && (
              <>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Annual Fee</div>
                  <div className="mt-1 text-2xl font-bold">
                    ${(subscription.annualFee / 100).toFixed(0)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">Per year</div>
                </div>
                {subscription.currentPeriodEnd && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Next Billing</div>
                    <div className="mt-1 text-2xl font-bold">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {new Date(subscription.currentPeriodEnd).getFullYear()}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {isCanceled && subscription.currentPeriodEnd && (
            <Alert className="mt-4">
              <Calendar className="h-4 w-4" />
              <AlertTitle>Subscription Canceling</AlertTitle>
              <AlertDescription>
                Your subscription will end on{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}. You&apos;ll revert to
                commission-based pricing.
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2 h-auto p-0"
                  onClick={handleReactivate}
                  disabled={actionLoading}
                >
                  Reactivate subscription
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {isPastDue && (
            <Alert variant="destructive" className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Payment Required</AlertTitle>
              <AlertDescription>
                Your last payment failed. Please update your payment method to continue your
                subscription.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Eligibility & Savings Card (if commission-based) */}
      {!isAnnualPlan && eligibility && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Annual Plan Eligibility</CardTitle>
                <CardDescription>Save up to 40% on commissions</CardDescription>
              </div>
              {eligibility.isEligible ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Eligible
                </Badge>
              ) : (
                <Badge variant="secondary">Not Eligible Yet</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {eligibility.isEligible ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-green-50 p-4 dark:bg-green-950">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
                    <div className="flex-1">
                      <div className="font-semibold text-green-900 dark:text-green-100">
                        You qualify for annual subscription!
                      </div>
                      <div className="mt-1 text-sm text-green-700 dark:text-green-300">
                        Estimated savings: $
                        {(eligibility.projectedSavings.annualSavings / 100).toFixed(0)}/year (
                        {(eligibility.projectedSavings.savingsPercentage * 100).toFixed(0)}%)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Current (Commission-Only)
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Commission Rate:</span>
                        <span className="font-medium">
                          {(subscription.commissionRate * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Projected Annual:</span>
                        <span className="font-medium">
                          ${(eligibility.projectedSavings.annualCommissions / 100).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Annual Subscription
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Commission Rate:</span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {eligibility.tierLevel === 'top' ? '8%' : '12%'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Annual Fee:</span>
                        <span className="font-medium">
                          ${eligibility.tierLevel === 'top' ? '1,490' : '490'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Button onClick={handleUpgrade} disabled={actionLoading} className="w-full">
                  <CreditCard className="mr-2 h-4 w-4" />
                  {actionLoading ? 'Processing...' : 'Upgrade to Annual Plan'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Complete these requirements to qualify for annual pricing:
                </p>
                <div className="space-y-2">
                  {Object.entries(eligibility.meetsRequirements).map(([key, met]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      {met ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={met ? 'text-foreground' : 'text-muted-foreground'}>
                        {key === 'monthsActive' && '3+ months active'}
                        {key === 'avgMonthlyRevenue' &&
                          `$${(eligibility.breakEvenMonthlyRevenue / 100).toFixed(0)}+ avg monthly bookings`}
                        {key === 'totalBookings' &&
                          `${eligibility.tierLevel === 'top' ? '50' : '15'}+ completed appointments`}
                        {key === 'rating' &&
                          `${eligibility.tierLevel === 'top' ? '4.5' : '4.0'}+ rating`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {isAnnualPlan && !isCanceled && (
        <Card>
          <CardHeader>
            <CardTitle>Manage Subscription</CardTitle>
            <CardDescription>Update your subscription settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={actionLoading}
              className="w-full sm:w-auto"
            >
              Cancel Subscription
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function SubscriptionDashboard() {
  return (
    <ComponentErrorBoundary fallbackMessage="Could not load subscription details">
      <SubscriptionDashboardInner />
    </ComponentErrorBoundary>
  );
}
