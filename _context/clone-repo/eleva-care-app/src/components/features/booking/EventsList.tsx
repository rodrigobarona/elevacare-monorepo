'use client';

import { CopyEventButton } from '@/components/features/booking/CopyEventButton';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatEventDescription } from '@/lib/utils/formatters';
import { updateEventActiveState, updateEventOrder } from '@/server/actions/events';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CalendarPlus,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Clock,
  Euro,
  ExternalLink,
  GripVertical,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';
import React from 'react';
import { toast } from 'sonner';

type Event = {
  id: string;
  slug: string;
  isActive: boolean;
  name: string;
  description: string | null;
  durationInMinutes: number;
  price: number;
};

interface EventsListProps {
  initialEvents: Event[];
  username: string;
}

export function EventsList({ initialEvents, username }: EventsListProps) {
  const [events, setEvents] = React.useState(initialEvents);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const promise = new Promise((resolve, reject) => {
        try {
          setEvents((items) => {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);

            const newItems = arrayMove(items, oldIndex, newIndex);

            // Create updates array with new order values
            const updates = newItems.map((item, index) => ({
              id: item.id,
              order: index,
            }));

            // Immediately update the database
            updateEventOrder(updates)
              .then(() => resolve(true))
              .catch((error) => {
                console.error('Failed to update event order:', error);
                setEvents(items); // Revert on error
                reject(error);
              });

            return newItems;
          });
        } catch (error) {
          reject(error);
        }
      });

      toast.promise(promise, {
        loading: 'Updating event order...',
        success: 'Event order updated',
        error: 'Failed to update event order',
      });
    }
  };

  const handleToggleActive = async (eventId: string, currentState: boolean) => {
    const promise = new Promise((resolve, reject) => {
      try {
        // Optimistically update the UI
        setEvents((prevEvents) =>
          prevEvents.map((event) =>
            event.id === eventId ? { ...event, isActive: !currentState } : event,
          ),
        );

        // Update the database
        updateEventActiveState(eventId, !currentState)
          .then((result) => {
            if (result?.error) throw new Error('Failed to update event');
            resolve(true);
          })
          .catch((error) => {
            setEvents((prevEvents) =>
              prevEvents.map((event) =>
                event.id === eventId ? { ...event, isActive: currentState } : event,
              ),
            );
            reject(error);
          });
      } catch (error) {
        reject(error);
      }
    });

    toast.promise(promise, {
      loading: 'Updating event...',
      success: `Event ${currentState ? 'deactivated' : 'activated'}`,
      error: 'Failed to update event',
    });
  };

  return (
    <div className="container space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">Manage your booking events and availability.</p>
        </div>
        <Button asChild>
          <Link href="/booking/events/new">
            <CalendarPlus className="mr-2 h-4 w-4" />
            New event
          </Link>
        </Button>
      </div>

      {events.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={events} strategy={verticalListSortingStrategy}>
            <Card className="overflow-hidden">
              <div className="divide-y divide-border">
                {events.map((event) => (
                  <SortableEventCard
                    key={event.id}
                    event={event}
                    username={username}
                    onToggleActive={handleToggleActive}
                  />
                ))}
              </div>
            </Card>
          </SortableContext>
        </DndContext>
      ) : (
        <Card className="flex flex-col items-center justify-center p-8 text-center">
          <CalendarRange className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No events yet</h3>
          <p className="mb-4 text-muted-foreground">
            Create your first event to start accepting bookings.
          </p>
          <Button asChild>
            <Link href="/booking/events/new">
              <CalendarPlus className="mr-2 h-4 w-4" />
              New event
            </Link>
          </Button>
        </Card>
      )}
    </div>
  );
}

function SortableEventCard({
  event,
  username,
  onToggleActive,
}: {
  event: Event;
  username: string;
  onToggleActive: (eventId: string, currentState: boolean) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn('relative', isDragging && 'z-50')}>
      <div
        className={cn(
          'flex items-center gap-4 bg-background p-4',
          !event.isActive && 'bg-muted/50',
          isDragging && 'shadow-lg',
        )}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                {...attributes}
                {...listeners}
                className="group -m-2 cursor-move touch-none rounded-md p-2 hover:bg-muted"
              >
                <div className="flex flex-col items-center gap-0.5 text-muted-foreground group-hover:text-foreground">
                  <ChevronUp className="h-3 w-3" />
                  <GripVertical className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Drag to reorder</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="min-w-0 grow">
          <div className="mb-1 flex items-start justify-between gap-4">
            <div>
              <Link
                href={`/booking/events/${event.slug}/edit`}
                className="group inline-flex items-center gap-2 hover:text-foreground"
              >
                <h3
                  className={cn(
                    'truncate font-semibold',
                    !event.isActive && 'text-muted-foreground',
                  )}
                >
                  {event.name}
                </h3>
                <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
              <CardDescription>{`/${username}/${event.slug}`}</CardDescription>
              <CardFooter className="mt-2 p-0">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatEventDescription(event.durationInMinutes)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                    <Euro className="h-3 w-3" />
                    {event.price === 0
                      ? 'Free'
                      : `${(event.price / 100).toFixed(2).replace(/\.00$/, '')}`}
                  </span>
                </span>
              </CardFooter>
            </div>
          </div>
        </div>

        <div className="ml-4 flex items-center gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  {!event.isActive && (
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      Inactive
                    </span>
                  )}
                  <Switch
                    checked={event.isActive}
                    onCheckedChange={() => onToggleActive(event.id, event.isActive)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{event.isActive ? 'Deactivate event' : 'Activate event'}</p>
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-1 border-l pl-4">
              <div className="inline-flex items-center rounded-md border">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild size="icon" variant="ghost" className="rounded-r-none border-r">
                      <a
                        href={`/${username}/${event.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open event page</p>
                  </TooltipContent>
                </Tooltip>

                <CopyEventButton
                  variant="ghost"
                  size="icon"
                  eventSlug={event.slug}
                  username={username}
                  wrapped
                  className="rounded-none border-r"
                />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild size="icon" variant="ghost" className="rounded-l-none">
                      <Link href={`/booking/events/${event.slug}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit event</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
