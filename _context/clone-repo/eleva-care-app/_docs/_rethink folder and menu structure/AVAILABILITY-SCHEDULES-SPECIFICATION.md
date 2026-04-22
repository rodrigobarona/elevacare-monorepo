# Availability & Schedules Specification

**Version:** 1.0  
**Date:** November 12, 2025  
**Status:** 🎨 Design Proposal  
**Inspired by:** Cal.com's schedule system

---

## Executive Summary

This document defines a **multi-schedule availability system** that allows experts to:

- ✅ Create multiple schedules for different contexts (remote, in-person, partner)
- ✅ Assign different schedules to different event types
- ✅ Work with or without calendar integrations (optional, not mandatory)
- ✅ Use built-in calendar view for booking management
- 🔮 Future: Support multiple calendar providers (Google, Outlook, Office 365)
- 🔮 Future: Choose specific calendar destination per event type

---

## Use Cases

### Use Case 1: Remote + In-Person Expert

**Scenario:** Dr. João works remotely most days but offers in-person sessions at a partner on Tuesday and Thursday afternoons.

**Solution:**

```
Schedule 1: "Remote Work" (Default)
├─ Monday-Friday: 9:00 AM - 5:00 PM
├─ Location: Remote (Video call)
└─ Timezone: America/Sao_Paulo

Schedule 2: "Partner - In-Person"
├─ Tuesday: 2:00 PM - 6:00 PM
├─ Thursday: 2:00 PM - 6:00 PM
├─ Location: Clínica São Paulo (Address)
└─ Timezone: America/Sao_Paulo

Event Types:
├─ "Online Consultation" → Uses Schedule 1 (Remote)
└─ "In-Person Consultation" → Uses Schedule 2 (Partner)
```

---

### Use Case 2: Expert Working at Multiple Partners

**Scenario:** Dr. Maria works part-time at two different partners with different schedules.

**Solution:**

```
Schedule 1: "Partner A - Morning"
├─ Monday, Wednesday, Friday: 8:00 AM - 12:00 PM
├─ Location: Partner A (Address)
└─ Timezone: America/Sao_Paulo

Schedule 2: "Partner B - Afternoon"
├─ Tuesday, Thursday: 2:00 PM - 6:00 PM
├─ Location: Partner B (Address)
└─ Timezone: America/Sao_Paulo

Schedule 3: "Remote Evenings"
├─ Monday-Thursday: 7:00 PM - 9:00 PM
├─ Location: Remote
└─ Timezone: America/Sao_Paulo

Event Types:
├─ "Partner A Session" → Uses Schedule 1
├─ "Partner B Session" → Uses Schedule 2
└─ "Evening Online Session" → Uses Schedule 3
```

---

### Use Case 3: Expert in Personal Practice + Partner Organization

**Scenario:** Dr. Ana has her own solo practice but also works part-time for a partner organization.

**Solution:**

```
Personal Organization:
├─ Schedule 1: "My Practice"
│   ├─ Monday, Wednesday, Friday: 9:00 AM - 5:00 PM
│   └─ Location: My Office (Address)
└─ Event Types: Personal consultation events

Partner Organization (Member):
├─ Schedule 2: "Partner Schedule"
│   ├─ Tuesday, Thursday: 10:00 AM - 4:00 PM
│   └─ Location: Partner Partner (Address)
└─ Event Types: Partner-assigned events
```

---

## Data Model

### Schedule Entity

```typescript
interface Schedule {
  id: string;
  userId: string; // Owner of the schedule
  organizationId?: string; // If schedule belongs to partner

  // Identity
  name: string; // "Remote Work", "Partner Tuesdays", "Evening Sessions"
  isDefault: boolean; // One schedule marked as default

  // Availability Rules
  timezone: string; // IANA timezone
  availability: WeeklyHours[]; // Weekly recurring availability
  dateOverrides: DateOverride[]; // Specific date changes

  // Location (where bookings happen)
  location: Location;

  // Status
  isActive: boolean;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

interface WeeklyHours {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  slots: TimeSlot[];
}

interface TimeSlot {
  startTime: string; // "09:00"
  endTime: string; // "17:00"
}

interface DateOverride {
  date: string; // ISO date "2025-12-25"
  type: 'unavailable' | 'custom'; // Block day or custom hours
  slots?: TimeSlot[]; // If custom hours
  reason?: string; // "Holiday", "Vacation", etc.
}

interface Location {
  type: 'remote' | 'inPerson' | 'phone' | 'hybrid';

  // For remote
  videoProvider?: 'zoom' | 'googleMeet' | 'teams' | 'custom';
  videoLink?: string; // Custom link if provider is 'custom'

  // For in-person
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    additionalInfo?: string; // Suite number, building, etc.
  };

  // For phone
  phoneNumber?: string;
  phoneInstructions?: string;
}
```

---

### Event Type Integration

```typescript
interface EventType {
  id: string;
  userId: string;

  // Basic info
  title: string;
  slug: string;
  description: string;
  duration: number; // minutes

  // Schedule Assignment
  scheduleId: string; // Which schedule to use for availability

  // Location (inherits from schedule but can override)
  locationOverride?: Location; // Override schedule's location if needed

  // Calendar Integration (where to save bookings)
  calendarDestination: CalendarDestination;

  // ... other fields
}

interface CalendarDestination {
  type: 'app-only' | 'external'; // Save only in app or also sync to external

  // If external
  provider?: 'google' | 'outlook' | 'office365' | 'apple';
  calendarId?: string; // Specific calendar within provider
  createMeetLink?: boolean; // Auto-create video link from provider
}
```

---

## UI/UX Flow

### Availability Section Navigation

```
🗓️ Availability
├─ 📋 Schedules (NEW)
│  ├─ Default schedule (Working Hours)
│  ├─ + Create New Schedule
│  └─ List of schedules:
│     ├─ Remote Work (Default) ⭐
│     ├─ Partner Tuesdays
│     └─ Evening Sessions
│
├─ ⚙️ Limits
│  ├─ Buffer times
│  ├─ Max bookings per day
│  └─ Booking window
│
└─ 📆 Calendar Connections (NEW)
   ├─ Google Calendar (Connected) ✅
   ├─ + Connect Outlook
   └─ + Connect Office 365
```

---

### Schedule Creation/Edit Flow

**Step 1: Basic Info**

```
┌─────────────────────────────────────────┐
│ Create Schedule                          │
├─────────────────────────────────────────┤
│                                          │
│ Schedule Name*                           │
│ [Remote Work Hours________________]      │
│                                          │
│ Timezone*                                │
│ [America/Sao_Paulo ▼]                   │
│                                          │
│ ☐ Set as default schedule               │
│                                          │
│ Location Type*                           │
│ ○ Remote (Video call)                   │
│ ○ In-person (Physical location)         │
│ ○ Phone call                             │
│                                          │
│ [Continue →]                             │
└─────────────────────────────────────────┘
```

**Step 2: Weekly Hours**

```
┌─────────────────────────────────────────┐
│ Set Your Availability                    │
├─────────────────────────────────────────┤
│                                          │
│ Monday    ☑️                             │
│   09:00 AM ▼  to  05:00 PM ▼  [+ Add]  │
│                                          │
│ Tuesday   ☑️                             │
│   09:00 AM ▼  to  05:00 PM ▼  [+ Add]  │
│                                          │
│ Wednesday ☑️                             │
│   09:00 AM ▼  to  05:00 PM ▼  [+ Add]  │
│                                          │
│ Thursday  ☐ Unavailable                  │
│                                          │
│ Friday    ☑️                             │
│   09:00 AM ▼  to  05:00 PM ▼  [+ Add]  │
│                                          │
│ Saturday  ☐ Unavailable                  │
│ Sunday    ☐ Unavailable                  │
│                                          │
│ [← Back]  [Save Schedule]                │
└─────────────────────────────────────────┘
```

**Step 3: Location Details** (if in-person selected)

```
┌─────────────────────────────────────────┐
│ Location Details                         │
├─────────────────────────────────────────┤
│                                          │
│ Location Name                            │
│ [Clínica São Paulo____________]         │
│                                          │
│ Street Address*                          │
│ [Av. Paulista, 1000___________]         │
│                                          │
│ Suite/Floor (optional)                   │
│ [10th Floor, Suite 1001_______]         │
│                                          │
│ City*          State*      Postal Code*  │
│ [São Paulo]    [SP ▼]      [01310-100]  │
│                                          │
│ Country*                                 │
│ [Brazil ▼]                               │
│                                          │
│ Additional Info (optional)               │
│ [Building has parking. Entrance B...]   │
│                                          │
│ [← Back]  [Save Schedule]                │
└─────────────────────────────────────────┘
```

---

### Event Type Creation - Schedule Assignment

```
┌─────────────────────────────────────────┐
│ Create Event Type                        │
├─────────────────────────────────────────┤
│ ... [basic info fields] ...              │
│                                          │
│ Availability*                            │
│ Which schedule should be used?           │
│                                          │
│ [Remote Work Hours (Default) ▼]         │
│   Options:                               │
│   • Remote Work Hours (Default) ⭐      │
│   • Partner Tuesdays                      │
│   • Evening Sessions                     │
│                                          │
│ Location will inherit from schedule:     │
│ 📍 Remote (Video call via Zoom)         │
│                                          │
│ ☐ Override location for this event       │
│                                          │
│ ... [duration, booking limits, etc.] ... │
│                                          │
│ Calendar Destination                     │
│ Where should bookings be saved?          │
│                                          │
│ ○ App calendar only                      │
│ ● App + Google Calendar                  │
│   [Primary Calendar ▼]                   │
│   ☑️ Auto-create Google Meet link        │
│ ○ App + Outlook Calendar                 │
│                                          │
│ [Save Event Type]                        │
└─────────────────────────────────────────┘
```

---

## Calendar Integration System

### Phase 1: Optional Integration (Current)

**Remove Mandatory Google Calendar:**

```typescript
// OLD (Mandatory)
interface UserOnboarding {
  steps: [
    'create-account',
    'connect-google-calendar', // ❌ MANDATORY
    'setup-availability',
    'create-event',
  ];
}

// NEW (Optional)
interface UserOnboarding {
  steps: [
    'create-account',
    'setup-availability', // Can do this without calendar
    'create-event',
  ];
  optional: [
    'connect-calendar', // Optional enhancement
  ];
}
```

**App-Only Bookings:**

- Store all bookings in Neon database
- Built-in calendar view in `/appointments/calendar`
- No external dependency
- Users can add calendar integration later

---

### Phase 2: Multi-Provider Support (Future)

**Supported Providers:**

```typescript
type CalendarProvider =
  | 'google' // Google Calendar
  | 'outlook' // Outlook.com
  | 'office365' // Microsoft 365
  | 'apple' // iCloud Calendar
  | 'caldav'; // Generic CalDAV

interface CalendarConnection {
  id: string;
  userId: string;
  provider: CalendarProvider;

  // OAuth tokens (encrypted)
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;

  // Provider details
  email: string; // Account email

  // Available calendars from this connection
  calendars: ConnectedCalendar[];

  // Status
  isActive: boolean;
  lastSyncAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface ConnectedCalendar {
  id: string; // Provider's calendar ID
  name: string; // "Work Calendar", "Personal"
  isPrimary: boolean;
  color?: string; // Calendar color from provider
  canWrite: boolean; // Permission to create events
}
```

**Per-Event Calendar Selection:**

```typescript
// Example: Event uses Google Calendar, but expert has multiple calendars
{
  eventType: "Initial Consultation",
  calendarDestination: {
    type: 'external',
    provider: 'google',
    connectionId: 'conn_123',
    calendarId: 'work-calendar@example.com', // Specific calendar
    createMeetLink: true
  }
}

// Another event uses Outlook
{
  eventType: "Follow-up Session",
  calendarDestination: {
    type: 'external',
    provider: 'outlook',
    connectionId: 'conn_456',
    calendarId: 'calendar-id-from-outlook',
    createMeetLink: false // Use Zoom instead
  }
}
```

---

## Built-in Calendar View

### Requirements

**Must Have:**

- ✅ Day, Week, Month views
- ✅ Show all bookings from app database
- ✅ Color-code by event type
- ✅ Click to view booking details
- ✅ Quick actions (reschedule, cancel)
- ✅ Filter by schedule/location
- ✅ Today indicator

**Should Have:**

- ✅ Drag-and-drop to reschedule (admin only)
- ✅ Time zone display
- ✅ Export to ICS file
- ✅ Print view

**Could Have:**

- 🔮 Show external calendar events (read-only)
- 🔮 Conflict detection with external calendars
- 🔮 Multiple calendars overlay

---

### Calendar View UI

```
┌──────────────────────────────────────────────────────────────────┐
│ 📅 Calendar                                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [< November 2025 >]  [Day|Week|Month]  [Today]  [⚙️ Filters]   │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         Mon 11  Tue 12  Wed 13  Thu 14  Fri 15  Sat 16    │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ 09:00   [Initial Consult]                                  │ │
│  │ 10:00           [Follow-up]                                │ │
│  │ 11:00                   [New Patient]                      │ │
│  │ 12:00   ─────────────────────────────────────────────────  │ │
│  │ 13:00                                                       │ │
│  │ 14:00   [In-Person] 🏥          [In-Person] 🏥           │ │
│  │ 15:00   (Partner)                (Partner)                   │ │
│  │ 16:00                                                       │ │
│  │ 17:00                                                       │ │
│  │ 18:00                                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Legend: 🏥 In-Person  💻 Remote  📞 Phone                       │
│          Partner Tuesdays  Remote Work  Evening Sessions          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Multiple Schedules (Priority)

**Week 1-2: Backend**

- [ ] Create `schedules` table in database
- [ ] Add `scheduleId` to `event_types` table
- [ ] Add `location` JSONB field to schedules
- [ ] Migration script for existing data
- [ ] API endpoints for schedule CRUD

**Week 3-4: Frontend**

- [ ] Schedules list page (`/availability/schedules`)
- [ ] Create/Edit schedule flow
- [ ] Schedule assignment in event type form
- [ ] Location configuration UI

**Week 5: Integration**

- [ ] Update booking availability calculation
- [ ] Test with multiple schedules
- [ ] Migration guide for existing users

---

### Phase 2: Optional Calendar Integration (Priority)

**Week 1-2:**

- [ ] Make Google Calendar optional in onboarding
- [ ] Add "App calendar only" option to event types
- [ ] Built-in calendar view (basic)
- [ ] Test booking flow without external calendar

**Week 3-4:**

- [ ] Enhanced calendar view (week/month)
- [ ] Filter by schedule
- [ ] Export to ICS
- [ ] Performance optimization

---

### Phase 3: Multi-Provider Calendar (Future)

**TBD:**

- [ ] OAuth flows for Outlook, Office 365
- [ ] Calendar connection management UI
- [ ] Per-event calendar destination
- [ ] Sync engine for multiple providers
- [ ] Conflict detection

---

## Database Schema

```sql
-- Schedules table
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  name VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT false,

  -- Availability
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  availability JSONB NOT NULL, -- WeeklyHours[]
  date_overrides JSONB DEFAULT '[]'::jsonb, -- DateOverride[]

  -- Location
  location JSONB NOT NULL, -- Location object

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_default_schedule_per_user
    EXCLUDE (user_id WITH =) WHERE (is_default = true)
);

-- Calendar connections table
CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  provider VARCHAR(50) NOT NULL, -- 'google', 'outlook', etc.
  email VARCHAR(255) NOT NULL,

  -- OAuth (encrypted)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,

  -- Connected calendars
  calendars JSONB DEFAULT '[]'::jsonb, -- ConnectedCalendar[]

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(user_id, provider, email)
);

-- Update event_types table
ALTER TABLE event_types
  ADD COLUMN schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  ADD COLUMN location_override JSONB,
  ADD COLUMN calendar_destination JSONB NOT NULL DEFAULT '{"type": "app-only"}'::jsonb;

-- Indexes
CREATE INDEX idx_schedules_user_id ON schedules(user_id);
CREATE INDEX idx_schedules_org_id ON schedules(organization_id);
CREATE INDEX idx_calendar_connections_user_id ON calendar_connections(user_id);
CREATE INDEX idx_event_types_schedule_id ON event_types(schedule_id);
```

---

## API Endpoints

### Schedules

```typescript
// List all schedules for user
GET /api/availability/schedules
Response: Schedule[]

// Get single schedule
GET /api/availability/schedules/:id
Response: Schedule

// Create schedule
POST /api/availability/schedules
Body: CreateScheduleDto
Response: Schedule

// Update schedule
PATCH /api/availability/schedules/:id
Body: UpdateScheduleDto
Response: Schedule

// Delete schedule
DELETE /api/availability/schedules/:id
Response: { success: boolean }

// Set default schedule
POST /api/availability/schedules/:id/set-default
Response: Schedule
```

### Calendar Connections

```typescript
// List connected calendars
GET /api/availability/calendars
Response: CalendarConnection[]

// Initiate OAuth flow
GET /api/availability/calendars/connect/:provider
Response: { authUrl: string }

// OAuth callback
GET /api/availability/calendars/callback/:provider
Query: { code: string, state: string }
Response: CalendarConnection

// Refresh calendar list
POST /api/availability/calendars/:id/refresh
Response: CalendarConnection

// Disconnect calendar
DELETE /api/availability/calendars/:id
Response: { success: boolean }
```

---

## Updated Navigation Structure

```
🗓️ Availability
├─ 📋 Schedules
│  ├─ All Schedules (list)
│  ├─ Create New Schedule
│  └─ [Schedule Details]
│     ├─ Edit Info
│     ├─ Weekly Hours
│     ├─ Date Overrides
│     └─ Location
│
├─ ⚙️ Limits
│  ├─ Buffer Times
│  ├─ Max Bookings
│  └─ Booking Window
│
└─ 📆 Calendar Connections
   ├─ Connected Calendars (list)
   ├─ Connect New Provider
   └─ [Calendar Settings]
```

---

## References

- **Cal.com Schedules:** https://cal.com/docs/core-features/schedules
- **Google Calendar API:** https://developers.google.com/calendar/api
- **Microsoft Graph Calendar:** https://learn.microsoft.com/en-us/graph/api/resources/calendar
- **CalDAV Standard:** https://datatracker.ietf.org/doc/html/rfc4791

---

## Success Metrics

### User Adoption

- % of users who create multiple schedules
- % of users who use app-only vs calendar integration
- Average number of schedules per user

### Technical

- Booking calculation performance with multiple schedules
- Calendar sync success rate
- API response times

### Business

- Reduction in support tickets about calendar issues
- User satisfaction with scheduling flexibility
- Feature adoption rate

---

**Next Steps:**

1. Review and approve this specification
2. Prioritize Phase 1 (Multiple Schedules)
3. Design database migrations
4. Create UI mockups
5. Begin implementation
