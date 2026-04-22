import { startOfDay } from 'date-fns';
import { z } from 'zod';

/**
 * Base schema for validating meeting data
 *
 * This schema defines the common fields required for all meeting-related operations:
 * - startTime: Must be a date in the future
 * - guestEmail: Must be a valid email
 * - guestName: Required field for the guest's name
 * - guestNotes: Optional notes from the guest about the meeting
 * - timezone: Required timezone identifier (e.g. 'America/New_York')
 */
const meetingSchemaBase = z.object({
  startTime: z.date().min(new Date()),
  guestEmail: z.string().email().min(1, 'Required'),
  guestName: z.string().min(1, 'Required'),
  guestNotes: z.string().optional(),
  timezone: z.string().min(1, 'Required'),
});

/**
 * Schema for validating meeting form data in the UI
 *
 * Extends the base meeting schema with:
 * - date: A date field that must be in the future (starting from the beginning of the current day)
 *
 * This schema is primarily used in the MeetingForm component to validate user inputs
 * before submitting the form to create a meeting.
 *
 * @see {@link components/organisms/forms/MeetingForm.tsx} for implementation
 */
export const meetingFormSchema = z
  .object({
    date: z.date().min(startOfDay(new Date()), 'Must be in the future'),
  })
  .merge(meetingSchemaBase);

/**
 * Schema for validating meeting data in server actions
 *
 * This schema defines all fields required for creating a meeting in the database:
 * - eventId: UUID of the associated event
 * - workosUserId: ID of the expert (WorkOS user)
 * - guestEmail: Email of the guest/client booking the meeting
 * - guestName: Name of the guest/client
 * - guestNotes: Optional notes from the guest about the meeting
 * - timezone: Timezone identifier for the meeting
 * - startTime: Start time of the meeting (in UTC)
 * - stripePaymentIntentId: Optional Stripe payment intent ID for paid meetings
 * - stripeSessionId: Optional Stripe session ID for paid meetings
 * - stripePaymentStatus: Optional payment status ('pending', 'processing', 'succeeded', 'failed', 'refunded')
 * - stripeAmount: Optional payment amount in cents
 * - stripeApplicationFeeAmount: Optional application fee amount in cents
 *
 * This schema is used in the createMeeting server action to validate incoming data
 * before processing the meeting creation.
 *
 * @see {@link server/actions/meetings.ts} for implementation
 */
export const meetingActionSchema = z.object({
  eventId: z.string().uuid(),
  workosUserId: z.string(),
  guestEmail: z.string().email(),
  guestName: z.string(),
  guestNotes: z.string().optional(),
  timezone: z.string(),
  startTime: z.date(),
  stripePaymentIntentId: z.string().optional(),
  stripeSessionId: z.string().optional(),
  stripePaymentStatus: z
    .enum(['pending', 'processing', 'succeeded', 'failed', 'refunded', 'unpaid', 'paid'])
    .optional(), // Aligned with potential Stripe statuses and internal DB enum
  stripeAmount: z.number().optional(),
  stripeApplicationFeeAmount: z.number().optional(),
  locale: z.string().default('en'),
});
