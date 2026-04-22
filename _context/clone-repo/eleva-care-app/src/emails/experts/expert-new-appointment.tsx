import { EmailButton, EmailLayout } from '@/components/emails';
import {
  createTableCellStyle,
  ELEVA_CARD_STYLES,
  ELEVA_COLORS,
  ELEVA_TEXT_STYLES,
  ELEVA_TYPOGRAPHY,
} from '@/emails/utils/brand-constants';
import type { SupportedLocale } from '@/emails/utils/i18n';
import { Heading, Hr, Section, Text } from '@react-email/components';
import React from 'react';

/**
 * Props for the ExpertNewAppointmentTemplate email component.
 * Exported for type-safe usage in consumers.
 */
export interface ExpertNewAppointmentProps {
  expertName?: string;
  clientName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  timezone?: string;
  appointmentDuration?: string;
  eventTitle?: string;
  meetLink?: string;
  notes?: string;
  locale?: SupportedLocale;
  /**
   * Base URL for dashboard links.
   * IMPORTANT: Must be provided explicitly by callers - resolve from
   * process.env.NEXT_PUBLIC_APP_URL || 'https://eleva.care' at the call site.
   */
  dashboardUrl: string;
}

/**
 * Email template sent to EXPERTS when they receive a new appointment booking
 * This is different from appointment-confirmation.tsx which is sent to PATIENTS
 *
 * @example
 * ```tsx
 * import ExpertNewAppointmentTemplate from '@/emails/experts/expert-new-appointment';
 *
 * // Render the template with props
 * const emailHtml = render(
 *   <ExpertNewAppointmentTemplate
 *     expertName="Patricia Mota"
 *     clientName="Marta Carvalho"
 *     appointmentDate="Wednesday, January 21, 2026"
 *     appointmentTime="12:30 PM"
 *     timezone="Europe/Lisbon"
 *     appointmentDuration="45 minutes"
 *     eventTitle="Physical Therapy Appointment"
 *     meetLink="https://meet.google.com/abc-defg-hij"
 *     locale="en"
 *   />
 * );
 * ```
 */
export default function ExpertNewAppointmentTemplate({
  expertName = 'Patricia Mota',
  clientName = 'Marta Carvalho',
  appointmentDate = 'Wednesday, January 21, 2026',
  appointmentTime = '12:30 PM',
  timezone = 'Europe/Lisbon',
  appointmentDuration = '45 minutes',
  eventTitle = 'Physical Therapy Appointment',
  meetLink = 'https://meet.google.com/abc-defg-hij',
  notes = 'First consultation - health check',
  locale = 'en',
  dashboardUrl, // Required prop - callers must provide explicitly
}: ExpertNewAppointmentProps) {
  const subject = `New Booking: ${eventTitle} with ${clientName}`;
  const previewText = `You have a new appointment with ${clientName} on ${appointmentDate} at ${appointmentTime}`;

  return (
    <EmailLayout
      subject={subject}
      previewText={previewText}
      headerVariant="branded"
      footerVariant="default"
      locale={locale}
    >
      {/* Success Banner */}
      <Section style={ELEVA_CARD_STYLES.success}>
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading2,
            margin: '0 0 8px 0',
            textAlign: 'center' as const,
          }}
        >
          📅 New Appointment Booked!
        </Heading>
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '0',
            textAlign: 'center' as const,
            fontWeight: ELEVA_TYPOGRAPHY.weights.medium,
          }}
        >
          A patient has booked a consultation with you
        </Text>
      </Section>

      {/* Personal Greeting to Expert */}
      <Section style={{ margin: '32px 0' }}>
        <Heading style={ELEVA_TEXT_STYLES.heading1}>New Appointment Confirmed</Heading>

        <Text style={{ ...ELEVA_TEXT_STYLES.bodyLarge, margin: '0 0 16px 0' }}>
          Hello {expertName},
        </Text>

        <Text style={ELEVA_TEXT_STYLES.bodyRegular}>
          Great news! <strong style={{ color: ELEVA_COLORS.primary }}>{clientName}</strong> has
          booked an appointment with you. The booking has been confirmed and added to your calendar.
        </Text>
      </Section>

      {/* Appointment Details */}
      <Section style={ELEVA_CARD_STYLES.branded}>
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading3,
            margin: '0 0 24px 0',
            borderBottom: `2px solid ${ELEVA_COLORS.primary}`,
            paddingBottom: '12px',
          }}
        >
          📋 Appointment Details
        </Heading>

        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <tbody>
            <tr>
              <td style={createTableCellStyle(true)}>Service:</td>
              <td style={{ ...createTableCellStyle(false, 'right'), color: ELEVA_COLORS.primary }}>
                {eventTitle}
              </td>
            </tr>
            <tr>
              <td style={createTableCellStyle(true)}>Patient:</td>
              <td style={{ ...createTableCellStyle(false, 'right'), color: ELEVA_COLORS.primary }}>
                {clientName}
              </td>
            </tr>
            <tr>
              <td style={createTableCellStyle(true)}>Date:</td>
              <td style={createTableCellStyle(false, 'right')}>{appointmentDate}</td>
            </tr>
            <tr>
              <td style={createTableCellStyle(true)}>Time:</td>
              <td style={createTableCellStyle(false, 'right')}>
                {appointmentTime} ({timezone})
              </td>
            </tr>
            <tr>
              <td style={createTableCellStyle(true)}>Duration:</td>
              <td style={createTableCellStyle(false, 'right')}>{appointmentDuration}</td>
            </tr>
            {notes && (
              <tr>
                <td style={createTableCellStyle(true)}>Patient Notes:</td>
                <td style={createTableCellStyle(false, 'right')}>{notes}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {/* Video Call Section */}
      {meetLink && (
        <Section style={ELEVA_CARD_STYLES.warning}>
          <Heading
            style={{
              ...ELEVA_TEXT_STYLES.heading3,
              color: ELEVA_COLORS.warning,
              margin: '0 0 16px 0',
            }}
          >
            🔗 Virtual Consultation Link
          </Heading>

          <Text style={{ ...ELEVA_TEXT_STYLES.bodyRegular, color: ELEVA_COLORS.warning }}>
            Use this link to join the video consultation at the scheduled time:
          </Text>

          <Section style={{ textAlign: 'center' as const, margin: '20px 0' }}>
            <EmailButton href={meetLink} variant="primary" size="lg">
              🎥 Join Video Call
            </EmailButton>
          </Section>

          <Text
            style={{
              ...ELEVA_TEXT_STYLES.caption,
              color: ELEVA_COLORS.warning,
              padding: '16px',
              backgroundColor: ELEVA_COLORS.background,
              borderRadius: '8px',
              border: `1px solid ${ELEVA_COLORS.neutral.light}`,
              fontStyle: 'italic',
            }}
          >
            💡 <strong style={{ color: ELEVA_COLORS.warning }}>Reminder:</strong> Please join 2-3
            minutes early to ensure everything is set up.
          </Text>
        </Section>
      )}

      {/* Preparation Tips */}
      <Section style={ELEVA_CARD_STYLES.default}>
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading3,
            margin: '0 0 20px 0',
          }}
        >
          📝 Before the Appointment
        </Heading>

        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '0 0 12px 0',
            paddingLeft: '8px',
            borderLeft: `3px solid ${ELEVA_COLORS.secondary}`,
          }}
        >
          • <strong style={{ color: ELEVA_COLORS.primary }}>Review:</strong> Check the patient notes
          above for context
        </Text>
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '0 0 12px 0',
            paddingLeft: '8px',
            borderLeft: `3px solid ${ELEVA_COLORS.secondary}`,
          }}
        >
          • <strong style={{ color: ELEVA_COLORS.primary }}>Prepare:</strong> Have any relevant
          resources ready
        </Text>
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '0 0 12px 0',
            paddingLeft: '8px',
            borderLeft: `3px solid ${ELEVA_COLORS.secondary}`,
          }}
        >
          • <strong style={{ color: ELEVA_COLORS.primary }}>Test:</strong> Ensure your camera and
          microphone work
        </Text>
      </Section>

      <Hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '40px 0' }} />

      {/* Dashboard Link */}
      <Section style={{ margin: '32px 0' }}>
        <Text style={ELEVA_TEXT_STYLES.bodyRegular}>
          <strong style={{ color: ELEVA_COLORS.primary }}>Manage your appointments</strong>
          <br />
          View and manage all your appointments in your dashboard.
        </Text>

        <Section style={{ textAlign: 'center' as const, margin: '20px 0' }}>
          <EmailButton
            href={new URL('/dashboard/appointments', dashboardUrl).href}
            variant="primary"
            size="lg"
          >
            View Dashboard
          </EmailButton>
        </Section>
      </Section>

      {/* Thank You */}
      <Section
        style={{
          ...ELEVA_CARD_STYLES.branded,
          textAlign: 'center' as const,
          marginTop: '32px',
        }}
      >
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyLarge,
            fontWeight: ELEVA_TYPOGRAPHY.weights.semibold,
            color: ELEVA_COLORS.primary,
            margin: '0',
          }}
        >
          🙏 Thank you for being part of Eleva Care!
        </Text>
        <Text style={{ ...ELEVA_TEXT_STYLES.bodyRegular, margin: '8px 0 0 0' }}>
          Together, we&apos;re providing exceptional healthcare to women.
        </Text>
      </Section>
    </EmailLayout>
  );
}

// Preview props for React Email - aligned with component defaults
ExpertNewAppointmentTemplate.PreviewProps = {
  expertName: 'Patricia Mota',
  clientName: 'Marta Carvalho',
  appointmentDate: 'Wednesday, January 21, 2026',
  appointmentTime: '12:30 PM',
  timezone: 'Europe/Lisbon',
  appointmentDuration: '45 minutes',
  eventTitle: 'Physical Therapy Appointment',
  meetLink: 'https://meet.google.com/abc-defg-hij',
  notes: 'First consultation - health check',
  locale: 'en',
  dashboardUrl: 'https://eleva.care',
} as ExpertNewAppointmentProps;
