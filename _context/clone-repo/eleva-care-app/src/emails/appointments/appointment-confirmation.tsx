import { EmailButton, EmailLayout } from '@/components/emails';
import {
  createTableCellStyle,
  ELEVA_BUTTON_STYLES,
  ELEVA_CARD_STYLES,
  ELEVA_COLORS,
  ELEVA_TEXT_STYLES,
  ELEVA_TYPOGRAPHY,
} from '@/emails/utils/brand-constants';
import type { SupportedLocale } from '@/emails/utils/i18n';
import { Heading, Hr, Section, Text } from '@react-email/components';
import React from 'react';

interface AppointmentConfirmationProps {
  expertName?: string;
  clientName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  timezone?: string;
  appointmentDuration?: string;
  eventTitle?: string;
  meetLink?: string;
  notes?: string;
  locale?: string;
}

export default function AppointmentConfirmationTemplate({
  expertName = 'Dr. Maria Santos',
  clientName = 'João Silva',
  appointmentDate = '2024-02-15',
  appointmentTime = '10:00',
  timezone = 'Europe/Lisbon',
  appointmentDuration = '60 minutes',
  eventTitle = 'Consulta de Cardiologia',
  meetLink = 'https://eleva.care/meet/apt_conf_123',
  notes = 'First consultation - health check',
  locale = 'en',
}: AppointmentConfirmationProps) {
  const subject = `Appointment Confirmed: ${eventTitle} with ${expertName}`;
  const previewText = `Your appointment with ${expertName} is confirmed for ${appointmentDate} at ${appointmentTime}`;

  return (
    <EmailLayout
      subject={subject}
      previewText={previewText}
      headerVariant="branded"
      footerVariant="default"
      locale={locale as SupportedLocale}
    >
      {/* Premium Success Banner - Eleva Branded */}
      <Section style={ELEVA_CARD_STYLES.success}>
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading2,
            margin: '0 0 8px 0',
            textAlign: 'center' as const,
          }}
        >
          ✅ Appointment Confirmed!
        </Heading>
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '0',
            textAlign: 'center' as const,
            fontWeight: ELEVA_TYPOGRAPHY.weights.medium,
          }}
        >
          Your healthcare consultation is secured
        </Text>
      </Section>

      {/* Premium Personal Greeting */}
      <Section style={{ margin: '32px 0' }}>
        <Heading style={ELEVA_TEXT_STYLES.heading1}>Your Appointment is Confirmed</Heading>

        <Text style={{ ...ELEVA_TEXT_STYLES.bodyLarge, margin: '0 0 16px 0' }}>
          Hello {clientName},
        </Text>

        <Text style={ELEVA_TEXT_STYLES.bodyRegular}>
          Great news! Your appointment with{' '}
          <strong style={{ color: ELEVA_COLORS.primary }}>{expertName}</strong> has been confirmed.
          We look forward to providing you with excellent healthcare.
        </Text>
      </Section>

      {/* Premium Appointment Details - Eleva Branded */}
      <Section style={ELEVA_CARD_STYLES.branded}>
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading3,
            margin: '0 0 24px 0',
            borderBottom: `2px solid ${ELEVA_COLORS.primary}`,
            paddingBottom: '12px',
          }}
        >
          📅 Appointment Details
        </Heading>

        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <tr>
            <td style={createTableCellStyle(true)}>Service:</td>
            <td style={{ ...createTableCellStyle(false, 'right'), color: ELEVA_COLORS.primary }}>
              {eventTitle}
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
          <tr>
            <td style={createTableCellStyle(true)}>Your Expert:</td>
            <td style={{ ...createTableCellStyle(false, 'right'), color: ELEVA_COLORS.primary }}>
              {expertName}
            </td>
          </tr>
          {notes && (
            <tr>
              <td style={createTableCellStyle(true)}>Notes:</td>
              <td style={createTableCellStyle(false, 'right')}>{notes}</td>
            </tr>
          )}
        </table>
      </Section>

      {/* Premium Virtual Meeting Section */}
      <Section style={ELEVA_CARD_STYLES.warning}>
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading3,
            color: ELEVA_COLORS.warning,
            margin: '0 0 16px 0',
          }}
        >
          🔗 Join Your Virtual Appointment
        </Heading>

        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            color: ELEVA_COLORS.warning,
            marginBottom: '20px',
          }}
        >
          When it&apos;s time for your appointment, simply click the button below to join the
          virtual consultation:
        </Text>

        <Section style={{ textAlign: 'center' as const, margin: '20px 0' }}>
          <EmailButton
            href={meetLink}
            style={{
              ...ELEVA_BUTTON_STYLES.primary,
              backgroundColor: ELEVA_COLORS.success,
              borderColor: ELEVA_COLORS.success,
            }}
          >
            🎥 Join Video Call
          </EmailButton>
        </Section>

        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodySmall,
            color: ELEVA_COLORS.warning,
            padding: '16px',
            backgroundColor: ELEVA_COLORS.surface,
            borderRadius: '8px',
            border: `1px solid ${ELEVA_COLORS.neutral.border}`,
            fontStyle: 'italic',
          }}
        >
          💡 <strong style={{ color: ELEVA_COLORS.warning }}>Tip:</strong> We recommend joining 2-3
          minutes early to test your camera and microphone.
        </Text>
      </Section>

      {/* Premium Preparation Section */}
      <Section style={ELEVA_CARD_STYLES.default}>
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading3,
            margin: '0 0 20px 0',
          }}
        >
          📋 Before Your Appointment
        </Heading>

        {[
          'Ensure you have a stable internet connection',
          'Prepare any questions you want to discuss',
          'Have your medical history or previous reports ready',
          'Find a quiet, private space for the consultation',
        ].map((item, index) => (
          <Text
            key={index}
            style={{
              ...ELEVA_TEXT_STYLES.bodyRegular,
              margin: '0 0 12px 0',
              paddingLeft: '8px',
              borderLeft: `3px solid ${ELEVA_COLORS.secondary}`,
            }}
          >
            • <strong style={{ color: ELEVA_COLORS.primary }}>Tip:</strong> {item}
          </Text>
        ))}
      </Section>

      <Hr style={{ margin: '40px 0', borderColor: ELEVA_COLORS.neutral.border }} />

      {/* Premium Support Information */}
      <Section style={{ margin: '32px 0' }}>
        <Text style={ELEVA_TEXT_STYLES.bodyRegular}>
          <strong style={{ color: ELEVA_COLORS.primary }}>Need assistance?</strong>
          <br />
          If you have any questions or need technical support, don&apos;t hesitate to reach out to
          our team.
        </Text>
      </Section>

      {/* Premium Closing */}
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
            color: ELEVA_COLORS.primary,
            fontWeight: ELEVA_TYPOGRAPHY.weights.semibold,
            margin: '0',
          }}
        >
          🙏 Thank you for choosing Eleva Care!
        </Text>
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '8px 0 0 0',
          }}
        >
          We&apos;re committed to providing you with exceptional healthcare.
        </Text>
      </Section>
    </EmailLayout>
  );
}
