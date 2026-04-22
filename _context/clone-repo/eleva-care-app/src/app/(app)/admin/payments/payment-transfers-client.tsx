'use client';

/**
 * Payment Transfers Client Component
 *
 * Client-side component for displaying and filtering payment transfers.
 * Features:
 * - Filterable table with status, date range, and expert filters
 * - Sortable columns (amount, date, status)
 * - Pagination with configurable page size
 * - Direct links to transfer details
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { Calendar, ChevronLeft, ChevronRight, Eye, Filter, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

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

type PaymentTransfersResponse = {
  data: PaymentTransfer[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export function PaymentTransfersClient({ data }: { data: PaymentTransfersResponse }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPage = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '10');
  const currentStatus = searchParams.get('status') || 'all';
  const expertId = searchParams.get('expertId') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';

  // Status counts
  const statusCounts = {
    pending: data.data.filter((t) => t.status === 'PENDING').length,
    approved: data.data.filter((t) => t.status === 'APPROVED').length,
    completed: data.data.filter((t) => t.status === 'COMPLETED').length,
    failed: data.data.filter((t) => t.status === 'FAILED').length,
  };

  // Helper to create URL with search params
  const createQueryString = (params: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams.toString());

    // Update with new values
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    }

    return newParams.toString();
  };

  // Handle navigation
  const handlePageChange = (page: number) => {
    router.push(`?${createQueryString({ page: page.toString() })}`);
  };

  // Handle filter changes
  const handleStatusChange = (status: string) => {
    const statusParam = status === 'all' ? '' : status;
    router.push(`?${createQueryString({ status: statusParam, page: '1' })}`);
  };

  const handleExpertIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Debounce could be added here
    router.push(`?${createQueryString({ expertId: value, page: '1' })}`);
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    router.push(`?${createQueryString({ [field]: value, page: '1' })}`);
  };

  const handleLimitChange = (limit: string) => {
    router.push(`?${createQueryString({ limit, page: '1' })}`);
  };

  const handleClearFilters = () => {
    router.push('/admin/payments');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            Pending
          </Badge>
        );
      case 'APPROVED':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            Approved
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Completed
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700">
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Pending</div>
            <div className="text-2xl font-bold">{statusCounts.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Approved</div>
            <div className="text-2xl font-bold">{statusCounts.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Completed</div>
            <div className="text-2xl font-bold">{statusCounts.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-muted-foreground">Failed</div>
            <div className="text-2xl font-bold">{statusCounts.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-end">
        <div className="w-full md:w-auto">
          <label htmlFor="status-filter" className="mb-2 block text-sm font-medium">
            Status
          </label>
          <Select value={currentStatus} onValueChange={handleStatusChange}>
            <SelectTrigger id="status-filter" className="w-full md:w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-auto">
          <label htmlFor="expert-id-filter" className="mb-2 block text-sm font-medium">
            Expert ID
          </label>
          <Input
            id="expert-id-filter"
            placeholder="Filter by expert ID"
            value={expertId}
            onChange={handleExpertIdChange}
            className="w-full md:w-[280px]"
          />
        </div>

        <div className="w-full md:w-auto">
          <label htmlFor="start-date-filter" className="mb-2 block text-sm font-medium">
            Start Date
          </label>
          <div className="relative">
            <Input
              id="start-date-filter"
              type="date"
              value={startDate}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
              className="w-full md:w-[180px]"
            />
            <Calendar className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="w-full md:w-auto">
          <label htmlFor="end-date-filter" className="mb-2 block text-sm font-medium">
            End Date
          </label>
          <div className="relative">
            <Input
              id="end-date-filter"
              type="date"
              value={endDate}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
              className="w-full md:w-[180px]"
            />
            <Calendar className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={handleClearFilters} className="h-10">
            <Filter className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
          <Button variant="default" onClick={() => router.refresh()} className="h-10">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Expert</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Session Date</TableHead>
              <TableHead>Transfer Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No payment transfers found
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell className="font-medium">{transfer.id}</TableCell>
                  <TableCell className="font-mono text-xs">{transfer.expertWorkosUserId}</TableCell>
                  <TableCell>{formatCurrency(transfer.amount, transfer.currency)}</TableCell>
                  <TableCell>{formatDate(transfer.sessionStartTime)}</TableCell>
                  <TableCell>{formatDate(transfer.scheduledTransferTime)}</TableCell>
                  <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/payments/${transfer.id}`}>
                        <Button size="sm" variant="ghost">
                          <Eye className="mr-1 h-4 w-4" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {Math.min((currentPage - 1) * limit + 1, data.pagination.total)} to{' '}
          {Math.min(currentPage * limit, data.pagination.total)} of {data.pagination.total}{' '}
          transfers
        </div>

        <div className="flex items-center space-x-2">
          <Select value={limit.toString()} onValueChange={handleLimitChange}>
            <SelectTrigger className="w-[70px]">
              <SelectValue placeholder="10" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-sm font-medium">
            Page {currentPage} of {data.pagination.totalPages}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= data.pagination.totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
