# Cal.com-Style Calendar Selection Implementation

**Use Case:** Let experts choose which calendars to sync for availability checking  
**Pattern:** List all calendars, let user toggle which ones to use  
**Date:** January 2025

---

## 🎯 Overview

This guide shows how to implement Cal.com-style calendar selection where:

1. ✅ Expert connects Google Calendar
2. ✅ App lists ALL their calendars
3. ✅ Expert toggles which calendars to check for conflicts
4. ✅ Expert chooses which calendar to store new events in
5. ✅ App NEVER modifies the calendar itself (only events)

---

## 📋 Required Scopes

```typescript
'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';
```

**Why:**

- `calendar.events` - Create/edit/delete events
- `calendar.calendarlist.readonly` - List user's calendars

**NOT needed:**

- ❌ `calendar` (full) - Too broad, requires OAuth verification

---

## 🏗️ Database Schema

Add calendar selection tracking to your database:

```typescript
// drizzle/schema-workos.ts

/**
 * Expert Calendar Settings
 *
 * Tracks which calendars to check for conflicts and where to create events
 */
export const ExpertCalendarSettingsTable = pgTable(
  'expert_calendar_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workosUserId: text('workos_user_id')
      .notNull()
      .references(() => UsersTable.workosUserId, { onDelete: 'cascade' }),
    orgId: uuid('org_id').references(() => OrganizationsTable.id),

    // Which calendar to create new appointment events in
    // Usually the primary calendar or a specific "Work" calendar
    targetCalendarId: text('target_calendar_id').notNull(), // e.g., 'primary' or 'example@gmail.com'

    // Calendars to check for conflicts (array of calendar IDs)
    // Expert can toggle which calendars should block availability
    conflictCheckCalendarIds: jsonb('conflict_check_calendar_ids')
      .$type<string[]>()
      .notNull()
      .default([]), // e.g., ['primary', 'work@company.com', 'personal@gmail.com']

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIndex: index('expert_calendar_settings_user_id_idx').on(table.workosUserId),
    // One settings record per expert
    uniqueUser: unique('unique_expert_calendar_settings').on(table.workosUserId),
  }),
);
```

---

## 💻 Implementation

### **Step 1: List User's Calendars**

```typescript
// app/api/calendars/list/route.ts
import { listUserCalendars } from '@/lib/integrations/google/calendar-list';

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (user.role !== 'expert') {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const calendars = await listUserCalendars(user.workosUserId);

    return Response.json({
      calendars: calendars.map((cal) => ({
        id: cal.id,
        name: cal.summary,
        description: cal.description,
        isPrimary: cal.primary,
        accessRole: cal.accessRole,
        backgroundColor: cal.backgroundColor,
        canWrite: cal.accessRole === 'owner' || cal.accessRole === 'writer',
      })),
    });
  } catch (error) {
    return new Response('Failed to fetch calendars', { status: 500 });
  }
}
```

### **Step 2: Get Current Calendar Settings**

```typescript
// server/actions/calendar-settings.ts
'use server';

import { db } from '@/drizzle/db';
import { ExpertCalendarSettingsTable } from '@/drizzle/schema-workos';
import { eq } from 'drizzle-orm';

// server/actions/calendar-settings.ts

export async function getCalendarSettings(workosUserId: string) {
  const settings = await db.query.ExpertCalendarSettingsTable.findFirst({
    where: eq(ExpertCalendarSettingsTable.workosUserId, workosUserId),
  });

  return (
    settings || {
      targetCalendarId: 'primary', // Default to primary calendar
      conflictCheckCalendarIds: ['primary'], // Default to checking primary only
    }
  );
}
```

### **Step 3: Update Calendar Settings**

```typescript
// server/actions/calendar-settings.ts
'use server';

export interface CalendarSettingsUpdate {
  targetCalendarId: string; // Where to create new events
  conflictCheckCalendarIds: string[]; // Which calendars to check for conflicts
}

export async function updateCalendarSettings(
  workosUserId: string,
  settings: CalendarSettingsUpdate,
) {
  // Validate that target calendar can be written to
  const { canWriteToCalendar } = await import('@/lib/integrations/google/calendar-list');
  const canWrite = await canWriteToCalendar(workosUserId, settings.targetCalendarId);

  if (!canWrite) {
    throw new Error('You do not have write access to the selected calendar');
  }

  // Upsert settings
  await db
    .insert(ExpertCalendarSettingsTable)
    .values({
      workosUserId,
      targetCalendarId: settings.targetCalendarId,
      conflictCheckCalendarIds: settings.conflictCheckCalendarIds,
    })
    .onConflictDoUpdate({
      target: ExpertCalendarSettingsTable.workosUserId,
      set: {
        targetCalendarId: settings.targetCalendarId,
        conflictCheckCalendarIds: settings.conflictCheckCalendarIds,
        updatedAt: new Date(),
      },
    });

  return { success: true };
}
```

### **Step 4: Calendar Selection UI Component**

```typescript
// app/[locale]/setup/calendar-settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface Calendar {
  id: string;
  name: string;
  description?: string;
  isPrimary: boolean;
  backgroundColor?: string;
  canWrite: boolean;
}

export default function CalendarSettingsPage() {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [targetCalendarId, setTargetCalendarId] = useState('primary');
  const [conflictCheckCalendarIds, setConflictCheckCalendarIds] = useState<string[]>(['primary']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCalendars() {
      // Fetch user's calendars
      const res = await fetch('/api/calendars/list');
      const data = await res.json();
      setCalendars(data.calendars);

      // Load current settings
      const settingsRes = await fetch('/api/calendars/settings');
      const settings = await settingsRes.json();
      setTargetCalendarId(settings.targetCalendarId);
      setConflictCheckCalendarIds(settings.conflictCheckCalendarIds);

      setLoading(false);
    }

    loadCalendars();
  }, []);

  const toggleConflictCheck = (calendarId: string) => {
    setConflictCheckCalendarIds(prev =>
      prev.includes(calendarId)
        ? prev.filter(id => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  const saveSettings = async () => {
    await fetch('/api/calendars/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetCalendarId,
        conflictCheckCalendarIds,
      }),
    });

    // Show success message
    alert('Calendar settings saved!');
  };

  if (loading) return <div>Loading calendars...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Calendar Settings</h2>
        <p className="text-muted-foreground">
          Choose which calendars to sync and where to create appointments
        </p>
      </div>

      {/* Where to create new events */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Add new events to:</h3>
          <p className="text-sm text-muted-foreground">
            Choose which calendar to create appointment events in
          </p>
        </div>

        <RadioGroup value={targetCalendarId} onValueChange={setTargetCalendarId}>
          {calendars.filter(cal => cal.canWrite).map(calendar => (
            <div key={calendar.id} className="flex items-center space-x-2">
              <RadioGroupItem value={calendar.id} id={`target-${calendar.id}`} />
              <Label htmlFor={`target-${calendar.id}`} className="flex items-center gap-2">
                {calendar.backgroundColor && (
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: calendar.backgroundColor }}
                  />
                )}
                <span>{calendar.name}</span>
                {calendar.isPrimary && (
                  <span className="text-xs text-muted-foreground">(Primary)</span>
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Which calendars to check for conflicts */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Check for conflicts:</h3>
          <p className="text-sm text-muted-foreground">
            Choose which calendars to check when showing your availability
          </p>
        </div>

        <div className="space-y-3">
          {calendars.map(calendar => (
            <div key={calendar.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {calendar.backgroundColor && (
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: calendar.backgroundColor }}
                  />
                )}
                <div>
                  <Label htmlFor={`conflict-${calendar.id}`}>{calendar.name}</Label>
                  {calendar.description && (
                    <p className="text-xs text-muted-foreground">
                      {calendar.description}
                    </p>
                  )}
                </div>
              </div>

              <Switch
                id={`conflict-${calendar.id}`}
                checked={conflictCheckCalendarIds.includes(calendar.id)}
                onCheckedChange={() => toggleConflictCheck(calendar.id)}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={saveSettings}
        className="w-full bg-primary text-primary-foreground py-2 px-4 rounded"
      >
        Save Calendar Settings
      </button>
    </div>
  );
}
```

### **Step 5: Check Availability Across Selected Calendars**

```typescript
// lib/integrations/google/availability.ts
'use server';

import { getCalendarSettings } from '@/server/actions/calendar-settings';
import { google } from 'googleapis';

import { getGoogleOAuthClient } from './oauth-tokens';

// lib/integrations/google/availability.ts

export async function checkAvailability(
  workosUserId: string,
  startTime: Date,
  endTime: Date,
): Promise<boolean> {
  const auth = await getGoogleOAuthClient(workosUserId);
  const calendar = google.calendar({ version: 'v3', auth });

  // Get which calendars to check
  const settings = await getCalendarSettings(workosUserId);

  // Check free/busy for all selected calendars
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      items: settings.conflictCheckCalendarIds.map((id) => ({ id })),
    },
  });

  // Check if ANY calendar has a conflict
  for (const calendarId of settings.conflictCheckCalendarIds) {
    const busyTimes = response.data.calendars?.[calendarId]?.busy || [];
    if (busyTimes.length > 0) {
      return false; // Conflict found
    }
  }

  return true; // No conflicts, time is available
}
```

### **Step 6: Create Event in Selected Calendar**

```typescript
// lib/integrations/google/events.ts
'use server';

import { getCalendarSettings } from '@/server/actions/calendar-settings';
import { google } from 'googleapis';

import { getGoogleOAuthClient } from './oauth-tokens';

// lib/integrations/google/events.ts

export async function createAppointmentEvent(
  workosUserId: string,
  eventData: {
    summary: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees?: string[]; // Guest emails
  },
) {
  const auth = await getGoogleOAuthClient(workosUserId);
  const calendar = google.calendar({ version: 'v3', auth });

  // Get target calendar (where to create the event)
  const settings = await getCalendarSettings(workosUserId);

  // Create event in selected calendar
  const response = await calendar.events.insert({
    calendarId: settings.targetCalendarId,
    requestBody: {
      summary: eventData.summary,
      description: eventData.description,
      start: {
        dateTime: eventData.startTime.toISOString(),
        timeZone: 'UTC', // Or use user's timezone
      },
      end: {
        dateTime: eventData.endTime.toISOString(),
        timeZone: 'UTC',
      },
      attendees: eventData.attendees?.map((email) => ({ email })),
      reminders: {
        useDefault: true,
      },
    },
  });

  return {
    eventId: response.data.id!,
    htmlLink: response.data.htmlLink,
  };
}
```

---

## 🎨 UI/UX Best Practices

### **Calendar List Display:**

```tsx
// Show calendar with visual indicators
<div className="calendar-item">
  {/* Calendar color indicator */}
  <div style={{ background: calendar.backgroundColor }} />

  {/* Calendar name */}
  <span>{calendar.name}</span>

  {/* Primary indicator */}
  {calendar.isPrimary && <Badge>Primary</Badge>}

  {/* Access level */}
  {calendar.accessRole === 'reader' && <span className="text-muted">Read-only</span>}

  {/* Toggle for conflict checking */}
  <Switch checked={isEnabled} />
</div>
```

### **Tooltips:**

- **Target Calendar:** "Appointment events will be created in this calendar"
- **Conflict Check:** "Check this calendar when showing your availability to patients"
- **Read-only Calendar:** "You can check this for conflicts, but can't create events here"

---

## ✅ Testing

### **Test 1: List Calendars**

```typescript
const calendars = await listUserCalendars(expertId);

console.log(calendars);
// Expected: Array of user's calendars with primary, work, personal, etc.
```

### **Test 2: Save Settings**

```typescript
await updateCalendarSettings(expertId, {
  targetCalendarId: 'work@company.com',
  conflictCheckCalendarIds: ['primary', 'work@company.com', 'personal@gmail.com'],
});

// Verify settings saved
const settings = await getCalendarSettings(expertId);
expect(settings.targetCalendarId).toBe('work@company.com');
expect(settings.conflictCheckCalendarIds).toHaveLength(3);
```

### **Test 3: Check Availability**

```typescript
const startTime = new Date('2025-01-15T10:00:00Z');
const endTime = new Date('2025-01-15T11:00:00Z');

const isAvailable = await checkAvailability(expertId, startTime, endTime);
// Should check ALL enabled calendars for conflicts
```

### **Test 4: Create Event**

```typescript
const event = await createAppointmentEvent(expertId, {
  summary: 'Patient Consultation',
  startTime: new Date('2025-01-15T10:00:00Z'),
  endTime: new Date('2025-01-15T11:00:00Z'),
  attendees: ['patient@example.com'],
});

// Verify event created in target calendar
expect(event.eventId).toBeDefined();
```

---

## 🔒 Security Considerations

### **Validate Calendar Access:**

```typescript
// Before saving settings, verify user has access
const canWrite = await canWriteToCalendar(userId, targetCalendarId);
if (!canWrite) {
  throw new Error('Cannot write to selected calendar');
}
```

### **RLS (Row Level Security):**

```sql
-- Only experts can access their own calendar settings
CREATE POLICY expert_calendar_settings_policy
ON expert_calendar_settings
FOR ALL
USING (workos_user_id = auth.user_id());
```

---

## 📚 References

- **Google Calendar API - Calendar List:** https://developers.google.com/calendar/api/v3/reference/calendarList
- **Google Calendar API - FreeBusy:** https://developers.google.com/calendar/api/v3/reference/freebusy
- **Cal.com Source Code:** https://github.com/calcom/cal.com

---

## ✅ Summary

**You can now:**

1. ✅ List all user's Google calendars
2. ✅ Let expert choose which calendar to create events in
3. ✅ Let expert toggle which calendars to check for conflicts
4. ✅ Check availability across multiple calendars
5. ✅ Create events in selected calendar
6. ✅ Never modify the calendar itself (only events)

**All with minimal scopes that avoid Google OAuth verification!** 🎉
