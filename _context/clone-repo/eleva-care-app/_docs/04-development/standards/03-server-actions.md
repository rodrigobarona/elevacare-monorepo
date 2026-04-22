# Server Actions

This directory contains server-side actions for the Eleva Care application. These actions handle various aspects of the application's business logic, from user management to payment processing.

## Overview

The server actions are organized into several modules, each handling a specific domain of functionality:

- 🔒 **Authentication & Profile Management**
- 💰 **Billing & Payments**
- 📅 **Scheduling & Meetings**
- 👥 **Expert Management**
- 📝 **Event Management**

## Modules

### Profile Management (`profile.ts`)

Handles expert profile management, including:

- Profile information updates
- Profile picture management with blob storage
- Social media link normalization and validation

```typescript
updateProfile(userId: string, data: ProfileFormValues): Promise<{ success: boolean } | { error: string }>
```

### Billing & Payments (`billing.ts`, `stripe.ts`)

Manages Stripe Connect integration and payment processing:

#### Billing Actions

- Stripe Connect account creation
- Dashboard access management

```typescript
handleConnectStripe(clerkUserId: string): Promise<string | null>
getConnectLoginLink(stripeConnectAccountId: string): Promise<string>
```

#### Stripe Actions

- Product and price management
- Payment intent creation
- Payment processing

```typescript
createStripeProduct(data: ProductData): Promise<StripeProduct>
updateStripeProduct(data: UpdateProductData): Promise<StripeProduct>
createPaymentIntent(data: PaymentIntentData): Promise<PaymentIntent>
```

### Scheduling & Meetings (`meetings.ts`, `schedule.ts`)

Handles meeting coordination and scheduling:

#### Meeting Management

- Meeting creation with validation
- Calendar integration
- Payment processing

```typescript
createMeeting(data: MeetingData): Promise<MeetingResult>
```

#### Schedule Management

- Expert availability management
- Time slot management

```typescript
saveSchedule(data: ScheduleData): Promise<{ error: boolean }>
```

### Expert Management (`experts.ts`)

Manages expert-specific functionality:

- Account verification
- Payout schedule management
- Connect account status checks

```typescript
verifyExpertConnectAccount(clerkUserId: string): Promise<VerificationResult>
getExpertPayoutSchedule(clerkUserId: string): Promise<PayoutSchedule>
verifySpecificExpertAccount(email: string): Promise<VerificationResult>
```

### Event Management (`events.ts`)

Handles event-related operations:

- Event creation and updates
- Active state management
- Event ordering

```typescript
createEvent(data: EventData): Promise<EventResult>
updateEvent(id: string, data: EventData): Promise<EventResult>
deleteEvent(id: string): Promise<EventResult>
updateEventOrder(updates: OrderUpdate[]): Promise<void>
```

### Dashboard Data (`dashboard.ts`)

Provides data for the role-aware dashboard. All functions are wrapped in `Sentry.withServerActionInstrumentation` and return safe defaults on error.

```typescript
getUpcomingMeetings(workosUserId: string, role: 'patient' | 'expert', limit?: number): Promise<DashboardMeeting[]>
getRecentMeetings(workosUserId: string, role: 'patient' | 'expert', limit?: number): Promise<DashboardMeeting[]>
getPatientStats(workosUserId: string): Promise<PatientStats>
getExpertStats(workosUserId: string): Promise<ExpertStats>
getExpertEarnings(workosUserId: string): Promise<ExpertEarnings>
```

Queries join `MeetingsTable`, `EventsTable`, `ProfilesTable`, and `TransactionCommissionsTable`. See [Dashboard Redesign](../ui-ux/06-dashboard-redesign.md) for full architecture.

## Usage Guidelines

### Error Handling

All actions include proper error handling and return consistent error formats:

```typescript
type ActionResult<T> = {
  error: boolean;
  message?: string;
  data?: T;
};
```

### Validation

- Input validation using Zod schemas
- Type safety with TypeScript
- Proper error messages for validation failures

### Security

- All actions use server-side validation
- Authentication checks via WorkOS AuthKit (`withAuth`)
- Proper permission checks for protected operations
- All actions instrumented with Sentry (see [Sentry Observability](./08-sentry-observability.md))

### Audit Logging

Most operations are logged for audit purposes, including:

- User ID
- IP Address
- Action type
- Timestamp
- Before/After states

## Best Practices

1. **Always use server-side validation**

   ```typescript
   const validatedData = await schema.parseAsync(unsafeData);
   ```

2. **Include proper error handling with Sentry**

   ```typescript
   import * as Sentry from '@sentry/nextjs';
   const { logger } = Sentry;

   try {
     // Operation
   } catch (error) {
     Sentry.captureException(error);
     logger.error('Operation failed', { error });
     return { error: true, message: 'Friendly error message' };
   }
   ```

3. **Use proper typing**

   ```typescript
   interface InputData {
     // Type definitions
   }
   ```

4. **Include audit logging**

   ```typescript
   await logAuditEvent(userId, 'action', 'resource', resourceId, oldData, newData);
   ```

## Testing

Each action should be tested for:

- Happy path scenarios
- Error cases
- Edge cases
- Input validation
- Authentication/Authorization

## Contributing

When adding new actions:

1. Follow the existing file structure
2. Include comprehensive JSDoc documentation
3. Add proper error handling
4. Include audit logging where appropriate
5. Add corresponding tests
6. Update this README with new functionality
