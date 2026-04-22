import { EventForm } from '@/components/features/forms/EventForm';

export default function NewEventPage() {
  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">New Event</h2>
        <p className="text-muted-foreground">
          Create a new event that users can book appointments for.
        </p>
      </div>
      <EventForm />
    </div>
  );
}
