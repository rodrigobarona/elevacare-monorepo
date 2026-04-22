'use client';

import { AppointmentCard } from '@/components/features/appointments/AppointmentCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateCustomerId } from '@/lib/utils/customerUtils';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { Calendar } from 'lucide-react';
import React from 'react';

interface Appointment {
  id: string;
  type: 'appointment';
  guestName: string;
  guestEmail: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  meetingUrl?: string;
  guestNotes?: string;
  stripePaymentStatus: string;
  stripeTransferStatus?: string;
}

interface Reservation {
  id: string;
  type: 'reservation';
  guestName: string;
  guestEmail: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  expiresAt: Date;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  eventId: string;
}

type AppointmentOrReservation = Appointment | Reservation;

type AppointmentWithCustomerId = AppointmentOrReservation & {
  customerId: string;
};

interface AppointmentsResponse {
  expertTimezone: string; // Expert's configured timezone from their schedule
  appointments: Array<
    Omit<Appointment, 'startTime' | 'endTime'> & {
      startTime: string;
      endTime: string;
    }
  >;
  reservations: Array<
    Omit<Reservation, 'startTime' | 'endTime' | 'expiresAt'> & {
      startTime: string;
      endTime: string;
      expiresAt: string;
    }
  >;
}

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center rounded-lg bg-gray-50 p-8 text-center">
    <Calendar className="mb-4 h-12 w-12 text-gray-400" />
    <h3 className="mb-1 text-lg font-medium text-gray-900">No appointments</h3>
    <p className="text-gray-500">{message}</p>
  </div>
);

export default function AppointmentsPage() {
  const { user, loading } = useAuth();
  const isLoaded = !loading;
  const [appointments, setAppointments] = React.useState<AppointmentOrReservation[]>([]);
  const [expertTimezone, setExpertTimezone] = React.useState<string>('UTC');
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadAppointments = React.useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/appointments');
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      // Store the expert's timezone from the API response
      if (data.expertTimezone) {
        setExpertTimezone(data.expertTimezone);
      }

      // Combine appointments and reservations, converting dates
      const allAppointments: AppointmentOrReservation[] = [
        ...data.appointments.map((apt: AppointmentsResponse['appointments'][0]) => ({
          ...apt,
          startTime: new Date(apt.startTime),
          endTime: new Date(apt.endTime),
        })),
        ...data.reservations.map((res: AppointmentsResponse['reservations'][0]) => ({
          ...res,
          startTime: new Date(res.startTime),
          endTime: new Date(res.endTime),
          expiresAt: new Date(res.expiresAt),
        })),
      ];

      console.log(
        `[Appointments Page] Loaded ${data.appointments.length} appointments and ${data.reservations.length} reservations (Expert timezone: ${data.expertTimezone})`,
      );
      setAppointments(allAppointments);
    } catch (error) {
      setError('Failed to load appointments');
      console.error('Error loading appointments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (isLoaded && user) {
      loadAppointments();
    }
  }, [isLoaded, user, loadAppointments]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Memoize appointments with customer IDs to prevent regeneration
  const appointmentsWithCustomerIds = React.useMemo(() => {
    if (!user?.id) return [] as AppointmentWithCustomerId[];

    return appointments.map(
      (item): AppointmentWithCustomerId => ({
        ...item,
        customerId: generateCustomerId(user.id, item.guestEmail),
      }),
    );
  }, [appointments, user?.id]);

  const renderAppointmentsMemoized = (filter: 'today' | 'future' | 'past' | 'all') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = appointmentsWithCustomerIds.filter((appointment) => {
      const appointmentDate = new Date(appointment.startTime);
      appointmentDate.setHours(0, 0, 0, 0);

      switch (filter) {
        case 'today':
          return appointmentDate.getTime() === today.getTime();
        case 'future':
          return appointmentDate > today;
        case 'past':
          return appointmentDate < today;
        default:
          return true;
      }
    });

    // Sort based on the filter type
    const sorted = filtered.sort((a, b) => {
      const dateA = new Date(a.startTime);
      const dateB = new Date(b.startTime);

      if (filter === 'future' || filter === 'today') {
        // For upcoming events: nearest date first
        return dateA.getTime() - dateB.getTime();
      }
      // For past events: most recent first
      return dateB.getTime() - dateA.getTime();
    });

    if (sorted.length === 0) {
      const messages = {
        today: 'You have no appointments or reservations scheduled for today.',
        future: 'You have no upcoming appointments or reservations scheduled.',
        past: 'You have no past appointments.',
        all: 'You have no appointments or reservations yet.',
      };

      return <EmptyState message={messages[filter]} />;
    }

    return sorted.map((item) => (
      <AppointmentCard
        key={`${item.id}-${item.customerId}`}
        appointment={item}
        customerId={item.customerId}
        expertTimezone={expertTimezone}
      />
    ));
  };

  if (!isLoaded || isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error: {error}
        <Button type="button" variant="link" onClick={loadAppointments} className="ml-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-3xl font-bold">Your Appointments & Reservations</h1>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="future">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="today">{renderAppointmentsMemoized('today')}</TabsContent>

        <TabsContent value="future">{renderAppointmentsMemoized('future')}</TabsContent>

        <TabsContent value="past">{renderAppointmentsMemoized('past')}</TabsContent>

        <TabsContent value="all">{renderAppointmentsMemoized('all')}</TabsContent>
      </Tabs>
    </div>
  );
}
