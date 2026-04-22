# BookingLayout Component

This component provides a modern three-panel layout for booking appointments, inspired by Cal.com's design.

## Features

- Three-panel layout with expert profile, calendar, and time slots
- Sticky expert profile panel
- Interactive calendar for date selection
- Time slot selection with 12h/24h toggling
- Responsive design

## Usage

```tsx
import { BookingLayout } from '@/components/organisms/BookingLayout';

export default function BookingPage() {
  return (
    <BookingLayout
      expert={{
        id: 'user-id',
        name: 'Expert Name',
        imageUrl: '/path/to/image.jpg',
        location: 'New York, USA',
      }}
      event={{
        id: 'event-id',
        title: 'Consultation',
        description: 'A detailed description of the consultation service.',
        duration: 45,
        price: 7000, // In cents (70.00)
        location: 'Google Meet',
      }}
    />
  );
}
```

## Integration with Existing Code

To integrate with your existing booking page:

1. Update your page component to use BookingLayout instead of the previous calendar implementation:

```tsx
import { Card, CardContent } from '@/components/atoms/card';
import { BookingLayout } from '@/components/organisms/BookingLayout';
import { Suspense } from 'react';

export default async function BookingPage({ params }) {
  const { username, eventSlug } = params;

  // Your existing code to fetch user and event data
  const user = await getUser(username);
  const event = await getEventType(user.id, eventSlug);

  return (
    <div className="container mx-auto py-6 md:py-8">
      <Card className="mx-auto max-w-5xl border-none p-0 shadow-none">
        <CardContent className="p-0">
          <Suspense fallback={<div className="h-96 w-full animate-pulse bg-muted"></div>}>
            <BookingLayout
              expert={{
                id: user.id,
                name: user.name,
                imageUrl: user.imageUrl || '/images/default-avatar.png',
                location: user.location,
              }}
              event={{
                id: event.id,
                title: event.name,
                description: event.description,
                duration: event.durationInMinutes,
                price: event.price,
                location: 'Google Meet', // Or any other meeting method
              }}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
```

2. Further customization can be done by modifying the BookingLayout component.

## Handling Form Submission

The BookingLayout component currently only handles the UI display. To integrate with your form submission logic:

1. Add a callback prop to the BookingLayout component:

```tsx
onTimeSlotSelect?: (date: Date, timeSlot: string) => void;
```

2. In your implementation, call this callback when a time slot is selected:

```tsx
<BookingLayout
  expert={...}
  event={...}
  onTimeSlotSelect={(date, timeSlot) => {
    // Your form submission logic
    router.push(`/booking/${username}/${eventSlug}/details?date=${date}&time=${timeSlot}`);
  }}
/>
```

## Responsive Considerations

The current implementation works best on desktop. For mobile, consider:

1. Using a stacked layout instead of grid
2. Showing only one panel at a time with navigation between them
3. Making the calendar more compact
