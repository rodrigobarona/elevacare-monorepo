'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils';
import {
  AlertCircle,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  ShieldAlert,
  ThumbsUp,
  User,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type PaymentTransfer = {
  id: number;
  paymentIntentId: string;
  checkoutSessionId: string;
  eventId: string;
  expertConnectAccountId: string;
  expertWorkosUserId: string;
  amount: number;
  platformFee: number;
  currency: string;
  sessionStartTime: string;
  scheduledTransferTime: string;
  status: string;
  transferId: string | null;
  stripeErrorCode: string | null;
  stripeErrorMessage: string | null;
  retryCount: number;
  requiresApproval: boolean;
  adminUserId: string | null;
  adminNotes: string | null;
  created: string;
  updated: string;
};

export function TransferDetailsClient({ transfer }: { transfer: PaymentTransfer }) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notes, setNotes] = useState(transfer.adminNotes || '');
  const [requiresApproval, setRequiresApproval] = useState(transfer.requiresApproval);
  const [openDialog, setOpenDialog] = useState(false);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case 'APPROVED':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            <ThumbsUp className="mr-1 h-3 w-3" />
            Approved
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Handle approving a transfer
  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const response = await fetch('/api/admin/payment-transfers/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transferId: transfer.id,
          notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve transfer');
      }

      toast.success('Transfer approved successfully');
      router.refresh();
    } catch (error) {
      console.error('Error approving transfer:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to approve transfer');
    } finally {
      setIsApproving(false);
      setOpenDialog(false);
    }
  };

  // Handle updating transfer settings
  const handleUpdateSettings = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/admin/payment-transfers', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transferId: transfer.id,
          requiresApproval,
          adminNotes: notes.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update transfer settings');
      }

      toast.success('Transfer settings updated successfully');
      router.refresh();
    } catch (error) {
      console.error('Error updating transfer settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update transfer settings');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Alert */}
      {transfer.status === 'FAILED' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Transfer Failed</AlertTitle>
          <AlertDescription>
            This transfer failed with error: {transfer.stripeErrorMessage || 'Unknown error'}
            {transfer.retryCount > 0 && ` (Retry attempts: ${transfer.retryCount})`}
          </AlertDescription>
        </Alert>
      )}

      {transfer.requiresApproval && transfer.status === 'PENDING' && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Approval Required</AlertTitle>
          <AlertDescription>
            This transfer requires manual approval before it can be processed.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Transfer Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Transfer Details
              {getStatusBadge(transfer.status)}
            </CardTitle>
            <CardDescription>Payment details and schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ID</p>
                <p>{transfer.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <p>{transfer.status}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Amount</p>
                <p className="font-semibold">
                  {formatCurrency(transfer.amount, transfer.currency)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Platform Fee</p>
                <p>{formatCurrency(transfer.platformFee, transfer.currency)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Session Time</p>
                <p>{formatDate(transfer.sessionStartTime)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Scheduled Transfer</p>
                <p>{formatDate(transfer.scheduledTransferTime)}</p>
              </div>
            </div>

            <hr className="my-4" />

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Payment Intent ID</p>
              <p className="break-all font-mono text-xs">{transfer.paymentIntentId}</p>
            </div>

            {transfer.transferId && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">Transfer ID</p>
                <p className="break-all font-mono text-xs">{transfer.transferId}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expert & Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Expert & Actions</CardTitle>
            <CardDescription>Manage transfer settings and approval</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center text-sm font-medium text-muted-foreground">
                <User className="mr-1 h-4 w-4" />
                Expert Details
              </div>
              <div className="space-y-2">
                <p>
                  <span className="font-medium">Expert ID:</span>{' '}
                  <span className="font-mono text-xs">{transfer.expertWorkosUserId}</span>
                </p>
                <p>
                  <span className="font-medium">Connect Account:</span>{' '}
                  <span className="font-mono text-xs">{transfer.expertConnectAccountId}</span>
                </p>
                <p>
                  <span className="font-medium">Event ID:</span>{' '}
                  <span className="font-mono text-xs">{transfer.eventId}</span>
                </p>
              </div>
            </div>

            <hr className="my-4" />

            <div>
              <label
                htmlFor="notes"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                Admin Notes
              </label>
              <Textarea
                id="notes"
                placeholder="Add notes about this transfer..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="max-h-32"
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="focus:ring-brand rounded border-gray-300"
                />
                Requires approval
              </label>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handleUpdateSettings} disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save Settings'}
            </Button>

            {transfer.status === 'PENDING' && (
              <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogTrigger asChild>
                  <Button variant="default" disabled={isApproving || transfer.status !== 'PENDING'}>
                    Approve Transfer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Approve Transfer</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to approve this transfer? It will be processed
                      immediately by the next scheduled job run.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="mb-2 font-medium">Transfer Details:</p>
                    <ul className="space-y-1 text-sm">
                      <li>
                        <span className="text-muted-foreground">Amount:</span>{' '}
                        {formatCurrency(transfer.amount, transfer.currency)}
                      </li>
                      <li>
                        <span className="text-muted-foreground">Expert ID:</span>{' '}
                        {transfer.expertWorkosUserId}
                      </li>
                      <li>
                        <span className="text-muted-foreground">Session Time:</span>{' '}
                        {formatDate(transfer.sessionStartTime)}
                      </li>
                    </ul>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpenDialog(false)}>
                      Cancel
                    </Button>
                    <Button variant="default" onClick={handleApprove} disabled={isApproving}>
                      {isApproving ? 'Approving...' : 'Approve Transfer'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Timeline or Additional Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="mr-2 h-5 w-5" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex">
              <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Payment received</p>
                <p className="text-sm text-muted-foreground">{formatDate(transfer.created)}</p>
              </div>
            </div>

            {transfer.adminUserId && (
              <div className="flex">
                <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                  <User className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Admin updated transfer</p>
                  <p className="text-sm text-muted-foreground">{formatDate(transfer.updated)}</p>
                  {transfer.adminNotes && (
                    <p className="mt-1 rounded-md bg-gray-50 p-2 text-sm">{transfer.adminNotes}</p>
                  )}
                </div>
              </div>
            )}

            {transfer.status === 'COMPLETED' && transfer.transferId && (
              <div className="flex">
                <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <Banknote className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Funds transferred to expert</p>
                  <p className="text-sm text-muted-foreground">{formatDate(transfer.updated)}</p>
                  <p className="mt-1 text-sm font-medium">
                    Transfer ID: <span className="font-mono text-xs">{transfer.transferId}</span>
                  </p>
                </div>
              </div>
            )}

            {transfer.status === 'FAILED' && (
              <div className="flex">
                <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Transfer failed</p>
                  <p className="text-sm text-muted-foreground">{formatDate(transfer.updated)}</p>
                  <div className="mt-1 rounded-md bg-red-50 p-2">
                    <p className="text-sm text-red-700">
                      {transfer.stripeErrorCode && (
                        <span className="block font-mono text-xs">
                          Error code: {transfer.stripeErrorCode}
                        </span>
                      )}
                      {transfer.stripeErrorMessage}
                    </p>
                  </div>
                  <p className="mt-2 text-sm">Retry attempts: {transfer.retryCount}</p>
                </div>
              </div>
            )}

            {transfer.status === 'PENDING' && (
              <div className="flex">
                <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Scheduled for transfer</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(transfer.scheduledTransferTime)}
                  </p>
                  {transfer.requiresApproval && (
                    <p className="mt-1 text-sm text-yellow-700">Requires manual approval</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
