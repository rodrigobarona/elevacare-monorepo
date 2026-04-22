'use client';

import { ComponentErrorBoundary } from '@/components/shared/ComponentErrorFallback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/lib/i18n/navigation';
import type { DashboardMeeting } from '@/server/actions/dashboard';
import { Calendar, Clock, ExternalLink, Video } from 'lucide-react';

interface UpcomingAppointmentsProps {
  meetings: DashboardMeeting[];
  role: 'patient' | 'expert';
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}

function isWithinHour(date: Date) {
  const now = new Date();
  const diff = new Date(date).getTime() - now.getTime();
  return diff > 0 && diff <= 60 * 60 * 1000;
}

function isToday(date: Date) {
  const now = new Date();
  const d = new Date(date);
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function UpcomingAppointmentsInner({ meetings, role }: UpcomingAppointmentsProps) {
  if (meetings.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">Upcoming Appointments</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={'/appointments' as any}>View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No upcoming appointments</p>
            {role === 'patient' && (
              <Button variant="link" size="sm" asChild className="mt-2">
                <Link href={'/experts' as any}>Find an Expert</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Upcoming Appointments</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={'/appointments' as any}>View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
        <div className="space-y-3">
          {meetings.map((meeting) => {
            const startingSoon = isWithinHour(meeting.startTime);
            const today = isToday(meeting.startTime);
            const personName =
              role === 'patient'
                ? [meeting.expertFirstName, meeting.expertLastName].filter(Boolean).join(' ') || 'Expert'
                : meeting.guestName;

            return (
              <div
                key={meeting.id}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{meeting.eventName}</p>
                    {startingSoon && (
                      <Badge variant="default" className="shrink-0 text-xs">
                        Starting soon
                      </Badge>
                    )}
                    {today && !startingSoon && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        Today
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {role === 'patient' ? 'with' : 'Patient:'} {personName}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(meeting.startTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(meeting.startTime)}
                    </span>
                  </div>
                </div>
                {meeting.meetingUrl && startingSoon && (
                  <Button variant="default" size="sm" asChild className="ml-3 shrink-0">
                    <a href={meeting.meetingUrl} target="_blank" rel="noopener noreferrer">
                      <Video className="mr-1.5 h-3.5 w-3.5" />
                      Join
                    </a>
                  </Button>
                )}
                {meeting.meetingUrl && !startingSoon && (
                  <Button variant="ghost" size="sm" asChild className="ml-3 shrink-0">
                    <a href={meeting.meetingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function UpcomingAppointments(props: UpcomingAppointmentsProps) {
  return (
    <ComponentErrorBoundary fallbackMessage="Could not load upcoming appointments">
      <UpcomingAppointmentsInner {...props} />
    </ComponentErrorBoundary>
  );
}
