'use client';

import { ComponentErrorBoundary } from '@/components/shared/ComponentErrorFallback';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardMeeting } from '@/server/actions/dashboard';
import { CheckCircle2 } from 'lucide-react';

interface RecentSessionsProps {
  meetings: DashboardMeeting[];
  role: 'patient' | 'expert';
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

function RecentSessionsInner({ meetings, role }: RecentSessionsProps) {
  if (meetings.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Recent Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {meetings.map((meeting) => {
            const personName =
              role === 'patient'
                ? [meeting.expertFirstName, meeting.expertLastName].filter(Boolean).join(' ') || 'Expert'
                : meeting.guestName;

            return (
              <div
                key={meeting.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium">{meeting.eventName}</p>
                  <p className="text-xs text-muted-foreground">
                    {role === 'patient' ? 'with' : 'Patient:'} {personName}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(meeting.startTime)}</p>
                </div>
                <Badge variant="secondary" className="ml-3 shrink-0 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Completed
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function RecentSessions(props: RecentSessionsProps) {
  return (
    <ComponentErrorBoundary fallbackMessage="Could not load recent sessions">
      <RecentSessionsInner {...props} />
    </ComponentErrorBoundary>
  );
}
