# Eleva Care Platform Documentation for AI Agents

## 1. Platform Overview

Eleva Care is a comprehensive healthcare platform designed to connect expert healthcare providers with clients seeking specialized care in pregnancy, postpartum, menopause, and sexual health domains. The platform enables experts to create profiles, offer services, manage schedules, and conduct consultations, while clients can discover experts, book appointments, and manage their healthcare journey.

### Core Value Proposition

- **For Experts**: A platform to showcase expertise, manage services, appointments and clients
- **For Clients**: Easy discovery of verified healthcare professionals for specialized care
- **For Admins**: Tools to manage users, content, and overall platform operations

## 2. Application Architecture

### 2.1 Technical Stack

- **Frontend**: Next.js 14+ with App Router, React Server Components
- **Authentication**: Clerk for user authentication and management
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: React Context, Server Components, client-side hooks
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Payments**: Stripe integration for service payments
- **API**: Next.js API routes and Server Actions

### 2.2 Code Organization

The application follows a structured organization pattern:

```
app/
  ├── (auth)/       # Authentication-related routes (sign-in, sign-up)
  ├── (private)/    # Authenticated user routes (dashboard, account)
  │    ├── (appointments)/  # Appointment booking and management
  │    ├── (booking)/       # Service booking flow
  │    ├── (settings)/      # User settings and admin features
  │    ├── account/         # User account management
  │    └── home/            # Personal dashboard
  ├── (public)/     # Public-facing routes (landing, about)
  │    └── [username]/      # Public expert profiles
  └── api/          # API endpoints
      ├── admin/           # Admin-specific APIs
      ├── auth/            # Authentication-related APIs
      ├── profile/         # Profile management APIs
      ├── stripe/          # Payment integration APIs
      └── webhooks/        # External service webhooks

components/
  ├── atoms/        # Base UI components (buttons, inputs)
  ├── molecules/    # Compound components (cards, forms)
  └── organisms/    # Complex components (layouts, feature sections)
```

### 2.3 Routing Structure

- **Public Routes** (`app/(public)/`): Accessible to all users
- **Auth Routes** (`app/(auth)/`): Authentication flows (sign-in, sign-up)
- **Private Routes** (`app/(private)/`): Protected routes requiring authentication
- **API Routes** (`app/api/`): Backend endpoints for data operations

## 3. Core Features and Components

### 3.1 User Authentication and Authorization

The platform uses Clerk for user authentication and implements a role-based authorization system:

- **User Roles**:
  - `superadmin`: Complete system access
  - `admin`: Administrative functions
  - `top_expert`: Featured expert capabilities
  - `community_expert`: Standard expert functions
  - `user`: Basic client access

- **Authorization Components**:
  - `AuthorizationProvider`: Context provider for role-based permissions
  - `RequireRole`: Component for conditional rendering based on roles
  - `RequirePermission`: Component for permission-based UI elements

- **Route Protection**:
  - Middleware checks for authentication
  - Server-side role verification
  - Private layout for authenticated routes

### 3.2 Expert Profiles

Experts can create and manage detailed profiles:

- **Profile Components**:
  - `ExpertForm`: Comprehensive form for profile creation/editing
  - `ProfilePublishToggle`: Controls profile visibility
  - `ExpertSetupChecklist`: Guides experts through setup process

- **Key Features**:
  - Expertise categorization
  - Verification badges
  - Service offerings
  - Availability management
  - Identity verification
  - Profile publishing control

### 3.3 Appointment and Booking System

The platform manages the complete booking and appointment flow:

- **Booking Components**:
  - `EventsList`: Displays expert services
  - `BookingCalendar`: Schedule selection
  - `CheckoutForm`: Payment processing

- **Appointment Management**:
  - Upcoming/past appointment views
  - Cancellation/rescheduling
  - Notifications
  - Follow-up booking

### 3.4 Payment Integration

Secure payment processing via Stripe:

- **Payment Components**:
  - `CheckoutForm`: Client payment form
  - `StripeConnectEmbed`: Expert payment account connection

- **Payment Flows**:
  - Service payment by clients
  - Expert payout management
  - Refund processing
  - Payment history

## 4. Key Workflows

### 4.1 Expert Onboarding

1. User registers and signs in
2. Completes profile with expertise details
3. Sets availability calendar
4. Creates services/events
5. Completes identity verification
6. Connects payment account
7. Publishes profile to become visible

### 4.2 Client Booking Flow

1. Discovers experts through search/browse
2. Views expert profile and services
3. Selects desired service
4. Chooses available time slot
5. Completes checkout with payment
6. Receives confirmation and details

### 4.3 Admin User Management

1. Admin accesses user management
2. Views/filters user list
3. Manages user roles and permissions
4. Verifies expert accounts
5. Monitors platform activity

## 5. Data Models

### 5.1 Key Tables

- **users**: Core user data linked to Clerk
- **profiles**: Expert profile information
- **categories**: Service categories and subcategories
- **events**: Service offerings by experts
- **schedules**: Expert availability timeframes
- **bookings**: Client service reservations
- **records**: Client health records (encrypted)

### 5.2 Relationships

- Users have one profile
- Profiles belong to categories
- Experts create multiple events
- Experts set multiple schedule slots
- Clients make multiple bookings
- Bookings link to specific events

## 6. Integration Points

### 6.1 External Services

- **Clerk**: User authentication, profile management
- **Stripe**: Payment processing and payouts
- **Vercel**: Hosting and deployment infrastructure
- **PostHog**: Analytics and user tracking
- **SendGrid**: Email notifications

### 6.2 Webhooks

- Clerk webhook for user events
- Stripe webhook for payment events
- Calendar integration webhooks

## 7. Development Patterns

### 7.1 Server Actions

Server-side operations are implemented as Server Actions for secure data operations. These actions are organized in the `/server/actions` folder and handle various backend operations:

#### 7.1.1 Core Server Actions

- **Profile Management**
  - `updateProfile`: Updates expert profile information with validation
  - `toggleProfilePublication`: Controls profile visibility with prerequisite checks
  - `checkExpertSetupStatus`: Verifies completion of expert setup steps

- **Scheduling and Availability**
  - `saveSchedule`: Manages expert availability time slots
  - `getExpertSchedule`: Retrieves availability for booking interfaces

- **Event and Service Management**
  - `createEvent`: Creates new service offerings
  - `updateEvent`: Modifies existing services
  - `deleteEvent`: Removes services
  - `updateEventOrder`: Changes display order of services
  - `updateEventActiveState`: Toggles service availability

- **Booking and Meetings**
  - `createMeeting`: Creates appointments with validation and conflict checks
  - `cancelMeeting`: Handles appointment cancellations
  - `rescheduleAppointment`: Manages appointment time changes

- **Payment Processing**
  - `handleConnectStripe`: Initiates Stripe onboarding for experts
  - `createPaymentIntent`: Processes payment for bookings
  - `verifyExpertConnectAccount`: Validates expert payment accounts

#### 7.1.2 Implementation Pattern

Server actions follow a consistent pattern:

1. **Authentication and Authorization**
   - Verify user is authenticated
   - Check appropriate role permissions

2. **Input Validation**
   - Use Zod schemas for type-safe validation
   - Return early with error messages for invalid inputs

3. **Business Logic**
   - Perform database operations
   - Integrate with external services (Stripe, Google Calendar)
   - Handle transactional operations when needed

4. **Response Structure**
   - Return consistent response objects
   - Include success/error flags
   - Provide meaningful error messages and codes

5. **Audit and Logging**
   - Log important operations for audit trails
   - Track changes to critical data

#### 7.1.3 Error Handling

Server actions implement robust error handling:

```typescript
{
  success: boolean,
  error?: string,
  code?: string,
  message?: string,
  data?: any
}
```

This consistent structure allows client components to handle errors appropriately and display relevant feedback to users.

### 7.2 Data Fetching Strategy

- Server Components for direct database queries
- API routes for client-side operations
- Revalidation paths for data freshness

### 7.3 Error Handling

- Structured API responses
- Client-side error messaging via toast notifications
- Server-side logging
- Error boundaries for UI resilience

## 8. UI/UX Patterns

### 8.1 Component Hierarchy

- Atomic design principles (atoms, molecules, organisms)
- Page layouts with consistent navigation
- Role-based UI rendering
- Responsive design for all devices

### 8.2 Theme and Design System

- Consistent color palette
- Typography system with font variables
- Spacing and layout guidelines
- Dark/light mode support

## 9. Performance Considerations

- Server components for reduced client JavaScript
- Optimized image handling
- Strategic data prefetching
- Pagination for large data sets

## 10. Security Measures

- Role-based access control
- Server-side data validation
- Encrypted sensitive data (health records)
- CSRF protection
- Rate limiting on API routes

## 11. Expert Verification and Publishing Process

### 11.1 Expert Setup Checklist

The platform implements a comprehensive verification process for experts through a structured checklist:

1. **Profile Completion**
   - Experts must complete their profile with personal information, expertise details, bio, and profile picture
   - The system validates that all required fields are filled

2. **Availability Configuration**
   - Experts must set their availability calendar
   - This defines when they're available for consultations

3. **Service Creation**
   - At least one service must be created
   - Services include details like duration, price, and description

4. **Identity Verification**
   - Experts must complete identity verification through Clerk's verification system
   - This ensures the platform only hosts legitimate healthcare professionals

5. **Payment Account Connection**
   - Experts must connect a Stripe account to receive payments
   - This enables secure payment processing for their services

### 11.2 Profile Publishing Mechanism

The profile publishing feature allows experts to control their visibility on the platform:

1. **Publication Requirements**
   - All setup checklist items must be completed before initial publication
   - The system performs a verification check before allowing publication

2. **Publication Control**
   - Experts can toggle their profile between published and unpublished states
   - When published, profiles become visible to potential clients
   - When unpublished, profiles are hidden from search and browse

3. **Server-Side Validation**
   - The `toggleProfilePublication` server action enforces all requirements
   - It checks for expert role authorization
   - It verifies all setup steps are complete before allowing publication
   - It handles the database update and path revalidation

4. **User Feedback**
   - The system provides clear feedback on publication status
   - When all steps are completed, a congratulatory toast notification appears
   - The notification includes a direct action button to publish the profile

5. **Progress Tracking**
   - A visual progress indicator shows completion percentage
   - Incomplete steps are clearly marked with action buttons
   - The system guides experts through the remaining steps in priority order

### 11.3 Metadata Management

- The system uses Clerk's user metadata to track setup progress
- Completion status is stored to prevent duplicate notifications
- The metadata is updated when steps are completed or become incomplete

## 12. Common AI Agent Tasks

When interacting with the Eleva platform, AI agents might need to:

1. **Understand user intent** based on route context (expert vs. client)
2. **Navigate role-specific features** based on authenticated user
3. **Interpret form submissions** for profile or booking operations
4. **Explain verification requirements** for experts
5. **Guide through booking processes** for clients
6. **Help troubleshoot common issues** with appointments or payments
7. **Assist with expert setup checklist completion**
8. **Explain profile publication requirements and process**

This documentation provides a comprehensive overview of the Eleva Care platform, its architecture, and core functionalities to assist AI agents in effectively understanding and interacting with the application.
