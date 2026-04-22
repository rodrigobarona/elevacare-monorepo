'use server';

import * as Sentry from '@sentry/nextjs';
import { getTranslations } from 'next-intl/server';
import { Resend } from 'resend';

const { logger } = Sentry;

// Lazy initialization to avoid build-time errors
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Define a type for Resend options matching Resend v4.8.0 API
type SendEmailParams = {
  from?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
};

/**
 * Sends an email using the Resend API
 *
 * @param params Email parameters including recipient, subject, and content
 * @returns Object with success status and message or error
 */
export async function sendEmail({
  from,
  to,
  subject,
  html,
  text,
  replyTo,
  cc,
  bcc,
}: SendEmailParams) {
  try {
    // Use default from address if not provided
    const fromAddress = from || process.env.RESEND_EMAIL_BOOKINGS_FROM;

    if (!fromAddress) {
      throw new Error('From address is not configured');
    }

    if (!html && !text) {
      throw new Error('Either HTML or text content must be provided');
    }

    // Check recipient email
    const toArray = Array.isArray(to) ? to : [to];
    if (!toArray.length || !toArray.every((email) => email.includes('@'))) {
      throw new Error('Invalid recipient email address');
    }

    const emailPayload = {
      from: fromAddress,
      to,
      subject,
      html: html ?? undefined,
      text: text ?? undefined,
      ...(replyTo && { replyTo }),
      ...(cc && { cc }),
      ...(bcc && { bcc }),
    };

    // Resend's CreateEmailOptions is a union requiring either `react` or `html`/`text`.
    // We always provide html or text (validated above), so this is safe.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await getResendClient().emails.send(emailPayload as any);

    if (error) {
      logger.error('Error sending email via Resend', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error: unknown) {
    logger.error('Failed to send email', {
      err: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unknown error occurred while sending email',
    };
  }
}

/**
 * Converts HTML content to plain text
 *
 * @param html HTML content to convert
 * @returns Plain text representation of the HTML
 */
function generatePlainTextFromHTML(html: string): string {
  // Basic conversion of HTML to plain text
  return (
    html
      // Replace common HTML elements with text equivalents
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '$1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
      .replace(/<tr[^>]*>(.*?)<\/tr>/gi, '$1\n')
      .replace(/<hr[^>]*>/gi, '\n---\n')
      // Handle links
      .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
      // Remove all other tags
      .replace(/<[^>]*>/g, '')
      // Clean up whitespace
      .replace(/&nbsp;/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      // Decode HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
  );
}

/**
 * Generates HTML and plain text for an appointment confirmation email
 * Now using the centralized React Email templates from /emails/
 *
 * @param params Parameters for the appointment email content
 * @param params.expertName The name of the expert for the appointment
 * @param params.clientName The name of the client booking the appointment
 * @param params.appointmentDate Date formatted as a string (e.g., "Monday, April 8, 2025")
 * @param params.appointmentTime Time formatted as a string (e.g., "10:30 AM - 11:30 AM")
 * @param params.timezone Timezone string (e.g., "America/Los_Angeles")
 * @param params.appointmentDuration Duration formatted as a string (e.g., "60 minutes")
 * @param params.eventTitle The title/type of the event or appointment
 * @param params.meetLink Optional Google Meet link for virtual appointments
 * @param params.notes Optional notes from the client
 * @param params.locale Optional locale code for email language (e.g., 'en', 'es', 'pt', 'br')
 * @returns Object containing HTML, plain text, and translated subject
 */
export async function generateAppointmentEmail(params: {
  expertName: string;
  clientName: string;
  appointmentDate: string; // Date only (e.g., "Monday, April 8, 2025")
  appointmentTime: string; // Time with timezone (e.g., "10:30 AM - 11:30 AM")
  timezone: string; // Explicit timezone (e.g., "America/Los_Angeles")
  appointmentDuration: string;
  eventTitle: string;
  meetLink?: string;
  notes?: string;
  locale?: string; // Locale code for multilingual emails ('en', 'es', 'pt', 'br')
}): Promise<{ html: string; text: string; subject: string }> {
  // Import the React Email template from the organized /emails/ directory
  const { default: AppointmentConfirmationTemplate } = await import(
    '@/emails/appointments/appointment-confirmation'
  );
  const { render } = await import('@react-email/render');

  const locale = params.locale || 'en';

  // Get the translated subject
  // TypeScript doesn't infer types correctly for nested namespaces
  const t = (await getTranslations({
    locale,
    namespace: 'notifications.appointmentConfirmation',
  })) as any;

  // Render the React Email template with the provided parameters
  const renderedHtml = await render(
    AppointmentConfirmationTemplate({
      expertName: params.expertName,
      clientName: params.clientName,
      appointmentDate: params.appointmentDate,
      appointmentTime: params.appointmentTime,
      timezone: params.timezone,
      appointmentDuration: params.appointmentDuration,
      eventTitle: params.eventTitle,
      meetLink: params.meetLink,
      notes: params.notes,
      locale: params.locale,
    }),
  );

  // Generate plain text version
  const plainText = generatePlainTextFromHTML(renderedHtml);

  return {
    html: renderedHtml,
    text: plainText,
    subject: t('subject'),
  };
}

/**
 * Generates HTML and plain text for a welcome email
 * Uses the centralized React Email welcome template
 */
export async function generateWelcomeEmail(params: {
  userName: string;
  dashboardUrl?: string;
  nextSteps?: Array<{
    title: string;
    description: string;
    actionUrl: string;
    actionText: string;
  }>;
  locale?: string;
}): Promise<{ html: string; text: string; subject: string }> {
  const { default: WelcomeEmailTemplate } = await import('@/emails/users/welcome-email');
  const { render } = await import('@react-email/render');

  const locale = params.locale || 'en';

  // Get the translated subject
  // TypeScript doesn't infer types correctly for nested namespaces
  const t = (await getTranslations({
    locale,
    namespace: 'notifications.welcome',
  })) as any;

  const renderedHtml = await render(
    WelcomeEmailTemplate({
      userName: params.userName,
      dashboardUrl: params.dashboardUrl || '/dashboard',
      nextSteps: params.nextSteps,
      locale: params.locale,
    }),
  );

  return {
    html: renderedHtml,
    text: generatePlainTextFromHTML(renderedHtml),
    subject: t('subject', { userName: params.userName }),
  };
}

/**
 * Generates HTML and plain text for a Multibanco booking pending email
 * Uses the centralized React Email Multibanco pending template
 */
export async function generateMultibancoBookingPendingEmail(params: {
  customerName: string;
  expertName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  timezone?: string;
  duration?: number;
  multibancoEntity: string;
  multibancoReference: string;
  multibancoAmount: string;
  voucherExpiresAt: string;
  hostedVoucherUrl: string;
  customerNotes?: string;
  locale?: string;
}): Promise<{ html: string; text: string; subject: string }> {
  const { default: MultibancoBookingPendingTemplate } = await import(
    '@/emails/payments/multibanco-booking-pending'
  );
  const { render } = await import('@react-email/render');

  const locale = params.locale || 'en';

  // Get the translated subject
  // TypeScript doesn't infer types correctly for nested namespaces
  const t = (await getTranslations({
    locale,
    namespace: 'notifications.multibancoBookingPending',
  })) as any;

  const renderedHtml = await render(
    MultibancoBookingPendingTemplate({
      customerName: params.customerName,
      expertName: params.expertName,
      serviceName: params.serviceName,
      appointmentDate: params.appointmentDate,
      appointmentTime: params.appointmentTime,
      timezone: params.timezone || 'Europe/Lisbon',
      duration: params.duration || 60,
      multibancoEntity: params.multibancoEntity,
      multibancoReference: params.multibancoReference,
      multibancoAmount: params.multibancoAmount,
      voucherExpiresAt: params.voucherExpiresAt,
      hostedVoucherUrl: params.hostedVoucherUrl,
      customerNotes: params.customerNotes,
      locale: params.locale,
    }),
  );

  return {
    html: renderedHtml,
    text: generatePlainTextFromHTML(renderedHtml),
    subject: t('subject', { serviceName: params.serviceName }),
  };
}

/**
 * Generates HTML and plain text for a Multibanco payment reminder email
 * Uses the centralized React Email Multibanco reminder template
 */
export async function generateMultibancoPaymentReminderEmail(params: {
  customerName: string;
  expertName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  timezone?: string;
  duration?: number;
  multibancoEntity: string;
  multibancoReference: string;
  multibancoAmount: string;
  voucherExpiresAt: string;
  hostedVoucherUrl: string;
  customerNotes?: string;
  reminderType?: string;
  daysRemaining?: number;
  locale?: string;
}): Promise<{ html: string; text: string; subject: string }> {
  const { default: MultibancoPaymentReminderTemplate } = await import(
    '@/emails/payments/multibanco-payment-reminder'
  );
  const { render } = await import('@react-email/render');

  const locale = params.locale || 'en';
  const isUrgent =
    params.reminderType === 'urgent' || (params.daysRemaining && params.daysRemaining <= 1);

  // Get the translated subject
  // TypeScript doesn't infer types correctly for nested namespaces
  const t = (await getTranslations({
    locale,
    namespace: 'notifications.multibancoPaymentReminder',
  })) as any;

  const renderedHtml = await render(
    MultibancoPaymentReminderTemplate({
      customerName: params.customerName,
      expertName: params.expertName,
      serviceName: params.serviceName,
      appointmentDate: params.appointmentDate,
      appointmentTime: params.appointmentTime,
      timezone: params.timezone || 'Europe/Lisbon',
      duration: params.duration || 60,
      multibancoEntity: params.multibancoEntity,
      multibancoReference: params.multibancoReference,
      multibancoAmount: params.multibancoAmount,
      voucherExpiresAt: params.voucherExpiresAt,
      hostedVoucherUrl: params.hostedVoucherUrl,
      customerNotes: params.customerNotes,
      reminderType: params.reminderType || 'urgent',
      daysRemaining: params.daysRemaining || 1,
      locale: params.locale,
    }),
  );

  return {
    html: renderedHtml,
    text: generatePlainTextFromHTML(renderedHtml),
    subject: t(isUrgent ? 'subject.urgent' : 'subject.gentle', { serviceName: params.serviceName }),
  };
}

/**
 * Generates HTML and plain text for notification emails
 * Uses the centralized React Email notification template
 */
export async function generateNotificationEmail(params: {
  title: string;
  message: string;
  userName?: string;
  actionUrl?: string;
  actionText?: string;
  locale?: string;
}): Promise<{ html: string; text: string; subject: string }> {
  const { default: NotificationEmailTemplate } = await import(
    '@/emails/notifications/notification-email'
  );
  const { render } = await import('@react-email/render');

  const locale = params.locale || 'en';

  // Get the translated subject format
  // TypeScript doesn't infer types correctly for nested namespaces
  const t = (await getTranslations({
    locale,
    namespace: 'notifications.general',
  })) as any;

  const renderedHtml = await render(
    NotificationEmailTemplate({
      title: params.title,
      message: params.message,
      userName: params.userName,
      actionUrl: params.actionUrl,
      actionText: params.actionText,
      locale: params.locale,
    }),
  );

  return {
    html: renderedHtml,
    text: generatePlainTextFromHTML(renderedHtml),
    subject: t('subject', { title: params.title }),
  };
}

/**
 * Generates HTML and plain text for expert notification emails
 * Uses the centralized React Email expert notification template
 */
export async function generateExpertNotificationEmail(params: {
  expertName: string;
  notificationTitle: string;
  notificationMessage: string;
  actionUrl?: string;
  actionText?: string;
  locale?: string;
}): Promise<{ html: string; text: string; subject: string }> {
  const { default: ExpertNotificationTemplate } = await import(
    '@/emails/experts/expert-notification'
  );
  const { render } = await import('@react-email/render');

  const locale = params.locale || 'en';

  // Get the translated subject
  // TypeScript doesn't infer types correctly for nested namespaces
  const t = (await getTranslations({
    locale,
    namespace: 'notifications.expertNotification',
  })) as any;

  const renderedHtml = await render(
    ExpertNotificationTemplate({
      expertName: params.expertName,
      notificationTitle: params.notificationTitle,
      notificationMessage: params.notificationMessage,
      actionUrl: params.actionUrl,
      actionText: params.actionText,
      locale: params.locale,
    }),
  );

  return {
    html: renderedHtml,
    text: generatePlainTextFromHTML(renderedHtml),
    subject: t('subject', { notificationTitle: params.notificationTitle }),
  };
}
