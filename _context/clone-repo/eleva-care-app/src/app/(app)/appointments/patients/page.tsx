'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { isValidCustomerId } from '@/lib/utils/customerUtils';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { AlertCircle, Calendar, CalendarClock, PlusCircle, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';

interface Customer {
  id: string;
  name: string;
  email: string;
  appointmentsCount: number;
  totalSpend: number;
  lastAppointment: string | null;
  stripeCustomerId: string;
}

const NoCustomersEmptyState = () => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
      <Users className="h-10 w-10 text-primary" />
    </div>
    <h3 className="mb-3 text-xl font-medium">No customers yet</h3>
    <p className="mb-6 max-w-sm text-muted-foreground">
      When clients book appointments with you, they&apos;ll appear here. Create an event and share
      it to start getting bookings.
    </p>
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button asChild>
        <Link href="/booking/events/new">
          <PlusCircle className="mr-2 h-4 w-4" />
          Create an event
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/booking/schedule">
          <CalendarClock className="mr-2 h-4 w-4" />
          Setup your schedule
        </Link>
      </Button>
    </div>
  </div>
);

const NoSearchResultsEmptyState = ({ query, onClear }: { query: string; onClear: () => void }) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
      <Search className="h-8 w-8 text-muted-foreground" />
    </div>
    <h3 className="mb-2 text-lg font-medium">No results found</h3>
    <p className="mb-4 text-muted-foreground">
      No customers matching &quot;{query}&quot; were found.
    </p>
    <Button variant="outline" onClick={onClear}>
      Clear search
    </Button>
  </div>
);

export default function CustomersPage() {
  const { user, loading } = useAuth();
  const isLoaded = !loading;
  const router = useRouter();
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = React.useState<Customer[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const loadCustomers = React.useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/customers').catch((err) => {
        console.error('Network error when fetching customers:', err);
        throw new Error('Network error: Could not connect to the server');
      });

      if (!response.ok) {
        console.error(`API error: ${response.status} ${response.statusText}`);
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Server responded with error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const customersData = data.customers || [];
      setCustomers(customersData);
      setFilteredCustomers(customersData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error loading customers:', errorMessage);
      setError(`Failed to load customers. ${errorMessage}`);
      setCustomers([]);
      setFilteredCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (isLoaded && user) {
      loadCustomers();
    }
  }, [isLoaded, user, loadCustomers]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);

    if (newQuery.trim() === '') {
      setFilteredCustomers(customers);
      return;
    }

    const query = newQuery.toLowerCase();
    const filtered = customers.filter(
      (customer) =>
        customer.name?.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query),
    );

    setFilteredCustomers(filtered);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredCustomers(customers);
  };

  const handleViewCustomer = (customer: Customer) => {
    // Validate customer ID format before navigation
    if (!isValidCustomerId(customer.id)) {
      console.error(`Invalid customer ID format: ${customer.id}`);
      setError('Invalid customer ID format');
      return;
    }

    router.push(`/appointments/patients/${customer.id}`);
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="container py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Customers</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>Please wait while we load your customer data.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Customers</h1>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Error</CardTitle>
            </div>
            <CardDescription className="mt-2">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              The server may be temporarily unavailable or the API endpoint might not be set up yet.
            </p>
            <div className="flex gap-3">
              <Button onClick={loadCustomers}>Try Again</Button>
              <Button variant="outline" asChild>
                <Link href="/appointments/events">Go to Events</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Customers</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Customers</CardTitle>
          <CardDescription>
            Manage and view details about clients who have booked with you.
          </CardDescription>
          {customers.length > 0 && (
            <div className="mt-4 flex w-full max-w-sm items-center space-x-2">
              <Input
                type="text"
                placeholder="Search by name or email"
                value={searchQuery}
                onChange={handleSearch}
                className="w-full"
              />
              {searchQuery ? (
                <Button type="button" size="icon" variant="outline" onClick={clearSearch}>
                  <span className="sr-only">Clear search</span>
                  <span aria-hidden="true">×</span>
                </Button>
              ) : null}
              <Button type="submit" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <NoCustomersEmptyState />
          ) : filteredCustomers.length === 0 && searchQuery.trim() !== '' ? (
            <NoSearchResultsEmptyState query={searchQuery} onClear={clearSearch} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Appointments</TableHead>
                  <TableHead>Total Spend</TableHead>
                  <TableHead>Last Appointment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name || 'N/A'}</TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{customer.appointmentsCount || 0}</TableCell>
                    <TableCell>{formatCurrency(customer.totalSpend || 0)}</TableCell>
                    <TableCell>
                      {customer.lastAppointment
                        ? new Date(customer.lastAppointment).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewCustomer(customer)}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
