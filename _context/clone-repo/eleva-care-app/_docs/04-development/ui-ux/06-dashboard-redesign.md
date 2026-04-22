# Dashboard Redesign -- Role-Aware with Stripe Embedded Components

**Date:** February 24, 2026
**Commit:** `6d2f7aeb`
**Files changed:** 12 (+1,176 / -226 lines)
**Status:** Implemented

---

## Overview

The `/dashboard` page was a placeholder with a static hero banner, a three-step setup wizard for experts, and three link cards (Appointments, Records, Patients). Patients saw only the hero and an Account button.

The redesign replaces this with a role-aware, data-driven dashboard that surfaces actionable insights:

- **Patient** -- upcoming appointments, booking stats, expert discovery
- **New Expert** (setup incomplete) -- guided setup progress, early metrics
- **Established Expert** (fully onboarded) -- performance stats, Stripe financials, earnings

---

## Architecture

```text
Request
  |
  v
page.tsx (Server Component)
  |-- withAuth({ ensureSignedIn: true })
  |-- isUserExpert(user.id)
  |
  +-- Expert path: parallel fetch
  |     |-- checkExpertSetupStatus()
  |     |-- ProfilesTable.published
  |     |-- UsersTable.stripeConnectAccountId
  |     |-- getExpertStats(userId)
  |     |-- getExpertEarnings(userId)
  |     |-- getUpcomingMeetings(userId, 'expert', 5)
  |     |-- getRecentMeetings(userId, 'expert', 3)
  |     |-- getStripeConnectAccountStatus() (if Connect exists)
  |     v
  |   ExpertDashboard (Client Component)
  |
  +-- Patient path: parallel fetch
        |-- getPatientStats(userId)
        |-- getUpcomingMeetings(userId, 'patient', 5)
        |-- getRecentMeetings(userId, 'patient', 3)
        v
      PatientDashboard (Client Component)
```

The server component handles all authentication and data fetching in parallel, then serializes the results as props to the appropriate client component. No client-side data fetching is needed on initial load.

---

## File Inventory

### Server

| File | Purpose |
| ---- | ------- |
| `src/server/actions/dashboard.ts` | 5 server actions for dashboard data queries |
| `src/app/(app)/dashboard/page.tsx` | Server component: auth, parallel fetch, role routing |
| `src/app/api/stripe/account-session/route.ts` | Expanded with `payments`, `balances`, `payouts_list` components |

### Client -- Role Dashboards

| File | Purpose |
| ---- | ------- |
| `src/app/(app)/dashboard/dashboard-patient.tsx` | Patient view: stats grid, appointments, quick actions |
| `src/app/(app)/dashboard/dashboard-expert.tsx` | Expert view: handles both new and established states |

### Client -- Shared Components

| File | Purpose |
| ---- | ------- |
| `components/stat-card.tsx` | Reusable card with icon, label, value, optional description |
| `components/upcoming-appointments.tsx` | Meeting list with "Starting soon" badges and Join buttons |
| `components/recent-sessions.tsx` | Completed sessions list |
| `components/quick-actions.tsx` | Role-specific CTA buttons |
| `components/expert-setup-progress.tsx` | Progress bar, step checklist, continue/publish CTAs |
| `components/earnings-overview.tsx` | Platform-side earnings from TransactionCommissionsTable |
| `components/stripe-financial-dashboard.tsx` | Tabbed Stripe embedded components (Balance, Payments, Payouts) |

All component paths are relative to `src/app/(app)/dashboard/`.

---

## Data Layer

Five server actions in `src/server/actions/dashboard.ts`, each wrapped in `Sentry.withServerActionInstrumentation`:

### Shared

| Function | Signature | Returns |
| -------- | --------- | ------- |
| `getUpcomingMeetings` | `(workosUserId, role, limit?)` | `DashboardMeeting[]` -- JOIN Meetings + Events + Profiles, startTime > now, ASC |
| `getRecentMeetings` | `(workosUserId, role, limit?)` | `DashboardMeeting[]` -- JOIN Meetings + Events + Profiles, startTime < now, DESC |

### Patient

| Function | Signature | Returns |
| -------- | --------- | ------- |
| `getPatientStats` | `(workosUserId)` | `PatientStats` -- upcomingSessions, totalBookings, uniqueExperts, nextAppointment |

### Expert

| Function | Signature | Returns |
| -------- | --------- | ------- |
| `getExpertStats` | `(workosUserId)` | `ExpertStats` -- upcomingSessions, totalSessions, sessionsThisMonth, uniquePatients |
| `getExpertEarnings` | `(workosUserId)` | `ExpertEarnings` -- totalNetEarnings, monthlyNetEarnings, pendingCommissions, currency |

All functions return safe defaults (zeros, empty arrays) on error and log failures to Sentry.

### Database Tables Queried

- `MeetingsTable` -- session records, guest/expert linkage, Stripe payment fields
- `EventsTable` -- event names, linked via `eventId`
- `ProfilesTable` -- expert first/last name, linked via `workosUserId`
- `TransactionCommissionsTable` -- earnings data, `netAmount`, `status`, `createdAt`

### Query Patterns

Patient and expert stats use conditional aggregation with `CASE WHEN` inside `count()` to compute upcoming, total, and this-month counts in a single query. Earnings use three parallel `SUM` queries (all-time processed, monthly processed, pending).

---

## Stripe Embedded Components

### Account Session API Changes

The `POST /api/stripe/account-session` endpoint was expanded to enable three additional components:

| Component | Features |
| --------- | -------- |
| `payments` | `refund_management`, `dispute_management`, `capture_payments` |
| `balances` | `instant_payouts`, `standard_payouts`, `edit_payout_schedule` |
| `payouts_list` | (no additional features) |

Previously enabled components (`account_onboarding`, `account_management`, `payouts`, `notification_banner`, `documents`) remain unchanged.

### Financial Dashboard Component

`stripe-financial-dashboard.tsx` wraps three Stripe Connect embedded components in a tabbed interface:

| Tab | Component | Purpose |
| --- | --------- | ------- |
| Balance | `ConnectBalances` | Available/pending balance, instant payout |
| Payments | `ConnectPayments` | Payment list with refund/dispute management |
| Payouts | `ConnectPayoutsList` | Payout history with filtering |

The component is **lazy-loaded** via `React.lazy()` in `dashboard-expert.tsx` and wrapped in a `Suspense` boundary. It only renders when `hasStripeAccount && chargesEnabled && payoutsEnabled`.

All Stripe components are themed via `STRIPE_CONNECT_APPEARANCE` from `src/config/stripe-appearance.ts`.

### Notification Banner

The expert dashboard renders `ConnectNotificationBanner` at the top whenever a Stripe Connect account exists, wrapped in its own `StripeConnectProvider`. This surfaces compliance alerts and action items from Stripe.

---

## Expert Dashboard States

The expert dashboard handles two states in a single component:

### New Expert (setup incomplete)

- Setup progress bar with step-by-step checklist (6 steps: Profile, Availability, Events, Identity, Payments, Google Calendar)
- Each step links to its setup page
- "Continue Setup" button targets the first incomplete step
- Stat cards show session counts (no financial data)

### Established Expert (fully onboarded)

- Stripe notification banner
- Stat cards include monthly earnings (currency-formatted)
- Upcoming appointments with Join/View buttons
- Side-by-side earnings overview (platform data) and Stripe financial dashboard (lazy-loaded)
- Quick actions: Appointments, Edit Profile, Billing, Schedule

The `showFinancials` flag (`hasStripeAccount && chargesEnabled && payoutsEnabled`) controls which stat cards and sections render.

---

## Patient Dashboard

- Welcome header with subtitle
- Four stat cards: Upcoming Sessions, Total Bookings, Experts Seen, Next Appointment
- Upcoming appointments list with "Starting soon" badges
- Quick actions: Find an Expert, My Appointments, Account
- Recent sessions list

---

## Component Details

### StatCard

Reusable card accepting `label`, `value`, `icon` (Lucide), and optional `description`. Uses `bg-primary/10` for the icon container, consistent with the Eleva design language.

### UpcomingAppointments

Renders a list of meetings with:

- "Starting soon" badge (within 1 hour) and "Today" badge
- Person name (expert name for patients, guest name for experts)
- Date/time formatting with `Intl.DateTimeFormat`
- "Join" button (primary) when starting soon, external link icon otherwise
- Empty state with role-appropriate CTA

### ExpertSetupProgress

Visual progress tracker with:

- `Progress` component (shadcn) showing completion percentage
- 2x3 grid of step links with check/circle icons
- "Setup complete -- Publish Profile" CTA when all steps done but profile not published
- "Continue Setup" button targeting the first incomplete step

---

## What Was Removed

- Off-brand indigo-to-purple-to-pink gradient hero banner
- Static three-step setup wizard (replaced with visual progress tracker)
- Three static link cards with no data (Appointments, Records, Patients)
- Direct database query in the page component (replaced with dedicated server actions)
- `next/link` import (replaced with `@/lib/i18n/navigation` Link where applicable)
