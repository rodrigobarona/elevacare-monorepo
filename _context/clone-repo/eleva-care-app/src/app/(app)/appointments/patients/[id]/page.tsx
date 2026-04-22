'use client';

import { AppointmentCard } from '@/components/features/appointments/AppointmentCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Calendar, CreditCard, Mail, User } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { Suspense } from 'react';

interface Appointment {
  id: string;
  type: 'appointment'; // Required to match AppointmentCard expectations
  guestName: string;
  guestEmail: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  meetingUrl?: string;
  guestNotes?: string;
  stripePaymentStatus: string;
  stripePaymentIntentId?: string;
  stripeTransferStatus?: string;
  eventName?: string;
  amount: number;
}

interface CustomerDetails {
  id: string;
  name: string;
  email: string;
  stripeCustomerId: string;
  totalSpend: number;
  appointmentsCount: number;
  lastAppointment: string | null;
  phoneNumber?: string;
  appointments: Appointment[];
  notes?: string;
  createdAt: string;
}

function CustomerDetailsContent() {
  const params = useParams();
  const customerId = params.id as string; // Now using the correct 'id' parameter
  const [customer, setCustomer] = React.useState<CustomerDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadCustomerDetails = async () => {
      try {
        setIsLoading(true);

        // Use the new ID-based API endpoint
        const response = await fetch(`/api/customers/${customerId}`);

        if (!response.ok) {
          console.error(`API error: ${response.status} ${response.statusText}`);
          throw new Error(`Error fetching customer details: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setCustomer(data.customer);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load customer details');
        console.error('Error loading customer details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCustomerDetails();
  }, [customerId]);

  if (isLoading) {
    return (
      <div className="container py-10">
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-10">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/appointments/patients"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Customers
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/appointments/patients">Return to Customers List</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container py-10">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/appointments/patients"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Customers
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Customer Not Found</CardTitle>
            <CardDescription>
              The customer you&apos;re looking for doesn&apos;t exist or has been deleted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/appointments/patients">Return to Customers List</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sort appointments by date (newest first)
  const sortedAppointments = [...(customer.appointments || [])]
    .map((appointment) => ({
      ...appointment,
      type: 'appointment' as const,
    }))
    .sort((a, b) => {
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

  // Group appointments by status
  const upcomingAppointments = sortedAppointments.filter(
    (appointment) => new Date(appointment.startTime) > new Date(),
  );

  const pastAppointments = sortedAppointments.filter(
    (appointment) => new Date(appointment.startTime) <= new Date(),
  );

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/appointments/patients"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Customer Info Card */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
            <CardDescription>Details about {customer.name || customer.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center">
                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{customer.name || 'Not provided'}</span>
              </div>

              <div className="flex items-center">
                <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{customer.email}</span>
              </div>

              {customer.phoneNumber && (
                <div className="flex items-center">
                  <span className="mr-2 text-muted-foreground">📱</span>
                  <span>{customer.phoneNumber}</span>
                </div>
              )}

              <div className="flex items-center">
                <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>
                  {customer.appointmentsCount} appointment
                  {customer.appointmentsCount !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center">
                <CreditCard className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Total spent: {formatCurrency(customer.totalSpend || 0)}</span>
              </div>

              {customer.stripeCustomerId && (
                <div className="mt-4 border-t pt-4">
                  <p className="mb-1 text-xs text-muted-foreground">Stripe Customer ID:</p>
                  <code className="rounded bg-muted p-1 text-xs">{customer.stripeCustomerId}</code>
                </div>
              )}

              {customer.notes && (
                <div className="mt-4 border-t pt-4">
                  <p className="mb-1 text-sm font-medium">Notes:</p>
                  <p className="text-sm text-muted-foreground">{customer.notes}</p>
                </div>
              )}

              <div className="mt-4 border-t pt-4 text-xs text-muted-foreground">
                <p>
                  Customer since: {new Date(customer.createdAt || Date.now()).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointments Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Appointments</CardTitle>
            <CardDescription>
              {customer.appointmentsCount
                ? `${customer.appointmentsCount} appointment${customer.appointmentsCount !== 1 ? 's' : ''} with this customer`
                : 'No appointments with this customer yet'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {customer.appointments && customer.appointments.length > 0 ? (
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All ({customer.appointments.length})</TabsTrigger>
                  <TabsTrigger value="upcoming">
                    Upcoming ({upcomingAppointments.length})
                  </TabsTrigger>
                  <TabsTrigger value="past">Past ({pastAppointments.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="all">
                  <div className="space-y-4">
                    {sortedAppointments.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        customerId={customer.id}
                      />
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="upcoming">
                  <div className="space-y-4">
                    {upcomingAppointments.length > 0 ? (
                      upcomingAppointments.map((appointment) => (
                        <AppointmentCard
                          key={appointment.id}
                          appointment={appointment}
                          customerId={customer.id}
                        />
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <p className="text-muted-foreground">
                          No upcoming appointments with this customer.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="past">
                  <div className="space-y-4">
                    {pastAppointments.length > 0 ? (
                      pastAppointments.map((appointment) => (
                        <AppointmentCard
                          key={appointment.id}
                          appointment={appointment}
                          customerId={customer.id}
                        />
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <p className="text-muted-foreground">
                          No past appointments with this customer.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="mb-2 text-muted-foreground">
                  This customer hasn&apos;t booked any appointments yet.
                </p>
                <Button asChild variant="outline">
                  <Link href="/booking/events/new">Create an event to share</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CustomerDetailsPage() {
  return (
    <Suspense fallback={<div className="container py-10">Loading customer details...</div>}>
      <CustomerDetailsContent />
    </Suspense>
  );
}
