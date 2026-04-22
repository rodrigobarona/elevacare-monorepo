import * as React from 'react';
import { EmailButton, EmailLayout } from '@/components/emails';
import { Heading, Hr, Section, Text } from '@react-email/components';

interface AppointmentReminderEmailProps {
  patientName?: string;
  expertName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  timezone?: string;
  duration?: number;
  appointmentType?: string;
  meetingLink?: string;
}

export const AppointmentReminderEmail = ({
  patientName = 'João Silva',
  expertName = 'Dr. Maria Santos',
  appointmentDate = 'Monday, February 19, 2024',
  appointmentTime = '2:30 PM - 3:30 PM',
  timezone = 'Europe/Lisbon',
  duration = 60,
  appointmentType = 'Consulta de Cardiologia',
  meetingLink = 'https://meet.google.com/abc-defg-hij',
}: AppointmentReminderEmailProps) => {
  const subject = `Reminder: Your appointment with ${expertName} is tomorrow`;
  const previewText = `Reminder: Your appointment with ${expertName} is tomorrow - ${appointmentType}`;

  return (
    <EmailLayout
      subject={subject}
      previewText={previewText}
      headerVariant="branded"
      footerVariant="default"
    >
      <Heading
        style={{
          color: '#006D77',
          fontSize: '28px',
          fontWeight: '600',
          margin: '0 0 24px 0',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        Appointment Reminder
      </Heading>

      <Text
        style={{
          color: '#4A5568',
          fontSize: '16px',
          lineHeight: '1.6',
          marginBottom: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        Hello {patientName}, this is a friendly reminder about your upcoming appointment.
      </Text>

      <Section
        style={{
          backgroundColor: '#F0FDFF',
          border: '1px solid #B8F5FF',
          borderRadius: '12px',
          padding: '24px',
          margin: '24px 0',
        }}
      >
        <Heading
          style={{
            color: '#006D77',
            fontSize: '20px',
            fontWeight: '600',
            margin: '0 0 16px 0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {appointmentType}
        </Heading>

        <Text
          style={{
            color: '#234E52',
            margin: '8px 0',
            fontSize: '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <strong>Your Expert:</strong> {expertName}
        </Text>

        <Text
          style={{
            color: '#234E52',
            margin: '8px 0',
            fontSize: '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <strong>Date:</strong> {appointmentDate}
        </Text>

        <Text
          style={{
            color: '#234E52',
            margin: '8px 0',
            fontSize: '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <strong>Time:</strong> {appointmentTime}
        </Text>

        <Text
          style={{
            color: '#234E52',
            margin: '8px 0',
            fontSize: '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <strong>Duration:</strong> {duration} minutes
        </Text>

        <Text
          style={{
            color: '#234E52',
            margin: '8px 0',
            fontSize: '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <strong>Timezone:</strong> {timezone}
        </Text>

        {meetingLink && (
          <Section style={{ textAlign: 'center', marginTop: '20px' }}>
            <EmailButton href={meetingLink} variant="primary" size="lg">
              Join Video Call
            </EmailButton>
          </Section>
        )}
      </Section>

      <Section
        style={{
          backgroundColor: '#FEFEFE',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '20px',
          margin: '24px 0',
        }}
      >
        <Heading
          style={{
            color: '#2D3748',
            fontSize: '18px',
            fontWeight: '600',
            margin: '0 0 16px 0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          How to prepare:
        </Heading>
        <Text
          style={{
            color: '#4A5568',
            fontSize: '15px',
            lineHeight: '1.6',
            margin: '8px 0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          • Have your medical history and current medications ready
        </Text>
        <Text
          style={{
            color: '#4A5568',
            fontSize: '15px',
            lineHeight: '1.6',
            margin: '8px 0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          • Prepare any questions you&apos;d like to discuss
        </Text>
        <Text
          style={{
            color: '#4A5568',
            fontSize: '15px',
            lineHeight: '1.6',
            margin: '8px 0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          • Ensure you have a stable internet connection for video calls
        </Text>
        <Text
          style={{
            color: '#4A5568',
            fontSize: '15px',
            lineHeight: '1.6',
            margin: '8px 0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          • Join the meeting 5 minutes early
        </Text>
      </Section>

      <Section
        style={{
          textAlign: 'center',
          margin: '32px 0',
          padding: '20px',
          backgroundColor: '#F8F9FA',
          borderRadius: '8px',
        }}
      >
        <Text
          style={{
            color: '#4A5568',
            fontSize: '16px',
            lineHeight: '1.6',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            margin: '0',
          }}
        >
          <strong style={{ color: '#006D77' }}>Need assistance?</strong>
          <br />
          If you have any questions or need support, please contact our team.
        </Text>
      </Section>

      <Hr
        style={{
          border: 'none',
          borderTop: '1px solid #E2E8F0',
          margin: '32px 0 24px 0',
        }}
      />

      <Text
        style={{
          color: '#718096',
          fontSize: '14px',
          lineHeight: '1.6',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        If you have any questions or need to make changes to your appointment, please contact our
        support team.
      </Text>
    </EmailLayout>
  );
};

export default AppointmentReminderEmail;

// Sample data for React Email preview
AppointmentReminderEmail.PreviewProps = {
  patientName: 'João Silva',
  expertName: 'Dr. Maria Santos',
  appointmentDate: 'Monday, February 19, 2024',
  appointmentTime: '2:30 PM - 3:30 PM',
  timezone: 'Europe/Lisbon',
  duration: 60,
  appointmentType: 'Consulta de Cardiologia',
  meetingLink: 'https://meet.google.com/abc-defg-hij',
} as AppointmentReminderEmailProps;
