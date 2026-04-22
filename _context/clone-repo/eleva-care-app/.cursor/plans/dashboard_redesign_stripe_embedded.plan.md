---
name: ""
overview: ""
todos: []
isProject: false
---

# Dashboard Redesign with Stripe Connect Embedded Components

## Problem Statement

The current `/dashboard` is a placeholder with:

- **Experts**: A setup checklist + 3 static link cards (Appointments, Records, Patients) with no actual data
- **Patients**: Only a hero banner and an Account button -- zero useful content
- No financial insights, no booking stats, no performance tracking
- The hero uses off-brand indigo/purple/pink gradient (not Eleva design language)

## Goal

Build a role-aware, data-driven dashboard that surfaces actionable insights for every user type:

1. **Patient** -- upcoming appointments, booking history, expert discovery
2. **New Expert** (setup incomplete or not onboarded) -- guided setup + early metrics
3. **Established Expert** (fully onboarded) -- performance analytics, Stripe financials, and operational tools

Leverage Stripe Connect embedded components (GA) to give experts a built-in financial dashboard without building custom payment UIs.

---

## Architecture Overview

```
src/app/(app)/dashboard/
├── page.tsx                          # Server component: auth, data fetching, role routing
├── dashboard-patient.tsx             # Client: patient dashboard
├── dashboard-expert.tsx              # Client: expert dashboard (handles both new & established)
├── components/
│   ├── stat-card.tsx                 # Reusable stat display card
│   ├── upcoming-appointments.tsx     # Shared: next appointments list
│   ├── quick-actions.tsx             # Role-specific action buttons
│   ├── expert-setup-progress.tsx     # Setup progress tracker (replaces current inline checklist)
│   ├── earnings-overview.tsx         # Expert: commission/earnings summary
│   └── stripe-financial-dashboard.tsx # Expert: Stripe embedded components wrapper
├── subscription/page.tsx             # (existing, untouched)
└── widgets-kitchen-sink/             # (existing, untouched)
```

---

## Data Requirements

### New Server Actions (`src/server/actions/dashboard.ts`)


| Function                                         | Returns                                                       | Used By    |
| ------------------------------------------------ | ------------------------------------------------------------- | ---------- |
| `getDashboardStats(workosUserId, role)`          | Unified stats object                                          | Both roles |
| `getUpcomingMeetings(workosUserId, role, limit)` | Next N meetings with event + guest/expert info                | Both roles |
| `getRecentMeetings(workosUserId, role, limit)`   | Last N completed meetings                                     | Both roles |
| `getExpertEarningsOverview(workosUserId)`        | Total/monthly earnings, commission breakdown, pending payouts | Expert     |
| `getPatientBookingSummary(workosUserId)`         | Total bookings, unique experts seen, next appointment         | Patient    |


### Database Queries

**Patient stats** (via `MeetingsTable`):

- Count total meetings where `guestWorkosUserId = userId`
- Count upcoming meetings (startTime > now)
- Count unique experts booked with
- Next upcoming appointment with event name + expert name

**Expert stats** (via `MeetingsTable` + `TransactionCommissionsTable`):

- Total meetings hosted (all time)
- Meetings this month
- Upcoming meetings count
- Total gross earnings (sum of `grossAmount` from commissions)
- Monthly earnings (current month)
- Pending commissions (status = 'pending')
- Total unique patients (distinct `guestWorkosUserId`)
- Average rating (future: when reviews are implemented)

---

## Phase 1: Foundation + Patient Dashboard

### 1A. Server Data Layer (`src/server/actions/dashboard.ts`)

Create centralized dashboard data fetching:

```typescript
// Upcoming meetings query (shared between patient & expert)
// JOIN MeetingsTable with EventsTable + ProfilesTable
// Patient: WHERE guestWorkosUserId = userId AND startTime > now()
// Expert: WHERE workosUserId = userId AND startTime > now()
// ORDER BY startTime ASC, LIMIT N

// Expert earnings overview
// SELECT SUM(grossAmount), SUM(commissionAmount), SUM(netAmount)
// FROM TransactionCommissionsTable WHERE workosUserId = userId
// GROUP by month for trend data
```

Wrap all functions with `Sentry.withServerActionInstrumentation`. Use `.$withCache()` where appropriate (stats can tolerate 60s staleness).

### 1B. Dashboard Page (Server Component)

Refactor `page.tsx` to:

1. Authenticate with `withAuth`
2. Parallel-fetch role, profile, setup status, and dashboard stats
3. Route to the correct client component based on role

### 1C. Patient Dashboard (`dashboard-patient.tsx`)

Layout:

```
┌─────────────────────────────────────────────────────────┐
│  Welcome, {firstName}!                                   │
│  Your health journey at a glance                         │
├────────────┬────────────┬────────────┬──────────────────┤
│ Upcoming   │ Total      │ Experts    │ Next Appointment │
│ Sessions   │ Bookings   │ Seen       │ {date + name}    │
├────────────┴────────────┴────────────┴──────────────────┤
│                                                          │
│  Upcoming Appointments                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Event Name  │ Expert  │ Date/Time  │ Join/View   │   │
│  │ ...         │ ...     │ ...        │ ...         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Quick Actions                                           │
│  [Find an Expert]  [My Appointments]  [Account]         │
│                                                          │
│  Recent Sessions                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Event Name  │ Expert  │ Date       │ Status      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1D. Shared Components

- `**stat-card.tsx**`: Reusable card with icon, label, value, optional trend indicator
- `**upcoming-appointments.tsx**`: Table/list of upcoming meetings (used by both roles)
- `**quick-actions.tsx**`: Role-specific CTA buttons

---

## Phase 2: Expert Dashboard (New Experts)

### 2A. Expert Setup Progress (`expert-setup-progress.tsx`)

Replace the current numbered list with a visual progress tracker:

- Step indicators with completion status
- Progress bar (X of 6 steps complete)
- Direct links to each incomplete step
- Celebrates completion with CTA to publish profile

### 2B. New Expert Dashboard View

When `isSetupComplete === false` or `accountStatus === null`:

```
┌─────────────────────────────────────────────────────────┐
│  Welcome, {firstName}!                                   │
│  Let's get your practice up and running                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Setup Progress                          [4/6 Complete]  │
│  ═══════════════════════════░░░░░░░░░░░                  │
│  ✓ Profile  ✓ Availability  ✓ Events                     │
│  ✓ Identity  ○ Payments     ○ Google Calendar             │
│                                                          │
│  [Continue Setup →]                                      │
│                                                          │
├────────────┬────────────┬──────────────────────────────┤
│ Sessions   │ Patients   │ Profile Views (future)       │
│ 0          │ 0          │ --                           │
├────────────┴────────────┴──────────────────────────────┤
│                                                          │
│  Quick Actions                                           │
│  [Complete Setup]  [Edit Profile]  [View Schedule]      │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 3: Expert Dashboard (Established Experts) + Stripe Embedded Components

### 3A. Account Session API Update

Expand `src/app/api/stripe/account-session/route.ts` to enable additional components:

```typescript
components: {
  // Existing (keep)
  account_onboarding: { enabled: true, ... },
  account_management: { enabled: true, ... },
  payouts: { enabled: true, ... },
  notification_banner: { enabled: true },
  documents: { enabled: true },

  // NEW for dashboard
  payments: {
    enabled: true,
    features: {
      refund_management: true,
      dispute_management: true,
      capture_payments: true,
      destination_on_behalf_of_charge_management: false,
    },
  },
  balances: {
    enabled: true,
    features: {
      instant_payouts: true,
      standard_payouts: true,
      edit_payout_schedule: true,
    },
  },
  payouts_list: { enabled: true },
}
```

### 3B. Stripe Financial Dashboard (`stripe-financial-dashboard.tsx`)

A tabbed client component wrapping Stripe embedded components:

```
┌─────────────────────────────────────────────────────────┐
│  Financial Overview                                      │
│  [Balance]  [Payments]  [Payouts]                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Tab: Balance (default)                                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │        <ConnectBalances />                        │   │
│  │   Available balance, pending, instant payout CTA  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Tab: Payments                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │        <ConnectPayments />                        │   │
│  │   Filterable payment list with refund/dispute     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Tab: Payouts                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │        <ConnectPayoutsList />                     │   │
│  │   Filterable payout history                       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Uses `StripeConnectProvider` with the centralized `STRIPE_CONNECT_APPEARANCE` theme.

### 3C. Earnings Overview (`earnings-overview.tsx`)

Platform-side earnings from `TransactionCommissionsTable`:

- Total net earnings (all time)
- This month's earnings vs last month (trend)
- Pending commissions
- Commission rate display

This complements the Stripe components (which show Stripe-side balance/payouts) with Eleva platform-specific commission data.

### 3D. Full Expert Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│  Welcome, {firstName}!                                   │
│  <ConnectNotificationBanner />                           │
├────────────┬────────────┬────────────┬──────────────────┤
│ Upcoming   │ This Month │ Total      │ Unique           │
│ Sessions   │ Earnings   │ Patients   │ Sessions (all)   │
│ {count}    │ €{amount}  │ {count}    │ {count}          │
├────────────┴────────────┴────────────┴──────────────────┤
│                                                          │
│  Upcoming Appointments                 [View All →]      │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Session Name │ Patient │ Date/Time │ Join / View  │   │
│  │ ...          │ ...     │ ...       │ ...          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────┐ ┌──────────────────────────┐   │
│  │ Earnings Overview    │ │ Financial Dashboard      │   │
│  │ (Platform data)      │ │ [Balance|Payments|Payouts│   │
│  │                      │ │  <Stripe Embedded>       │   │
│  │ Net: €X,XXX          │ │                          │   │
│  │ This month: €XXX     │ │                          │   │
│  │ Pending: €XX         │ │                          │   │
│  └─────────────────────┘ └──────────────────────────┘   │
│                                                          │
│  Quick Actions                                           │
│  [Appointments] [Edit Profile] [Billing] [Schedule]     │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 4: Polish & Quality

### 4A. Design Alignment

- Use Eleva color palette throughout (no more indigo/purple/pink gradient)
- Stat cards use `eleva-primary` for icons, `eleva-secondary` for trends
- Cards use `border-border`, `bg-card`, consistent with rest of app
- Stripe embedded components themed via `STRIPE_CONNECT_APPEARANCE`
- DM Sans font throughout

### 4B. Loading States

- Skeleton loaders for stat cards
- `<Suspense>` boundaries around:
  - Upcoming appointments list
  - Earnings overview
  - Stripe financial dashboard (heaviest -- loaded lazily)
- Stripe components have built-in loading via `onLoaderStart`

### 4C. Error Handling

- Each section degrades gracefully (show fallback card if data fails)
- Stripe component errors: toast + error state, never crash the page
- Sentry instrumentation on all dashboard server actions
- Sentry logger for all error paths

### 4D. Caching Strategy

- Dashboard stats: `.$withCache({ tag: 'dashboard-stats-{userId}', config: { ex: 60 } })`
- Upcoming meetings: `.$withCache({ tag: 'upcoming-meetings-{userId}', config: { ex: 30 } })`
- Commission totals: `.$withCache({ tag: 'commissions-{userId}', config: { ex: 120 } })`
- Invalidate on booking creation, payment completion, commission recording

### 4E. Responsive Design

- Stat cards: 2-col on mobile, 4-col on desktop
- Upcoming appointments: stacked cards on mobile, table on desktop
- Financial dashboard: full-width tabs on mobile
- Stripe components are already mobile-optimized

---

## Execution Order


| Step | Phase | Description                                                               | Dependencies     |
| ---- | ----- | ------------------------------------------------------------------------- | ---------------- |
| 1    | 1A    | Create `src/server/actions/dashboard.ts` with data queries                | Schema knowledge |
| 2    | 1D    | Build shared components (stat-card, upcoming-appointments, quick-actions) | None             |
| 3    | 1C    | Build patient dashboard                                                   | Steps 1, 2       |
| 4    | 2A    | Build expert-setup-progress component                                     | None             |
| 5    | 2B    | Build new expert dashboard view                                           | Steps 1, 2, 4    |
| 6    | 3A    | Expand account-session API (add payments, balances, payouts_list)         | None             |
| 7    | 3B    | Build stripe-financial-dashboard component                                | Step 6           |
| 8    | 3C    | Build earnings-overview component                                         | Step 1           |
| 9    | 3D    | Build established expert dashboard                                        | Steps 1-8        |
| 10   | 1B    | Rewrite page.tsx to route between dashboards                              | Steps 3, 5, 9    |
| 11   | 4A-E  | Polish: design, loading, errors, caching, responsive                      | Step 10          |


---

## Stripe Components Used (GA only)


| Component                   | Location                           | Purpose                                   |
| --------------------------- | ---------------------------------- | ----------------------------------------- |
| `ConnectNotificationBanner` | Expert dashboard header            | Compliance alerts, action items           |
| `ConnectBalances`           | Financial dashboard "Balance" tab  | Available/pending balance, instant payout |
| `ConnectPayments`           | Financial dashboard "Payments" tab | Payment list with refund/dispute          |
| `ConnectPayoutsList`        | Financial dashboard "Payouts" tab  | Payout history with filtering             |
| `ConnectAccountOnboarding`  | Billing page (existing)            | Initial onboarding                        |
| `ConnectAccountManagement`  | Billing page (existing)            | Account settings                          |
| `ConnectPayouts`            | Billing page (existing)            | Payout management                         |
| `ConnectDocuments`          | Billing page (existing)            | Tax documents                             |


All themed via `STRIPE_CONNECT_APPEARANCE` from `src/config/stripe-appearance.ts`.

---

## Out of Scope (Future)

- **Reviews/ratings**: No schema yet -- add when reviews are implemented
- **Profile analytics**: View counts, conversion rates -- requires analytics events
- **Capital/financing**: Preview-only components, skip for now
- **Tax components**: Preview-only, skip for now
- **Mobile native**: Using responsive web only
- **Real-time updates**: Polling or WebSocket for live stats -- future enhancement

