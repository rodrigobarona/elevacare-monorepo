import * as React from 'react';
import { EmailButton, EmailLayout } from '@/components/emails';
import { Heading, Hr, Section, Text } from '@react-email/components';

interface ExpertNotificationEmailProps {
  expertName?: string;
  notificationTitle?: string;
  notificationMessage?: string;
  actionUrl?: string;
  actionText?: string;
  locale?: string;
}

export const ExpertNotificationEmail = ({
  expertName = 'Dr. Maria Santos',
  notificationTitle = 'New Appointment Request',
  notificationMessage = 'You have received a new appointment request from João Silva for a cardiology consultation. Please review the request and confirm your availability.',
  actionUrl = 'https://eleva.care/dashboard/appointments',
  actionText = 'View Appointments',
}: ExpertNotificationEmailProps) => {
  const subject = `${notificationTitle} - Eleva Care`;
  const previewText = `${notificationTitle} - ${notificationMessage.substring(0, 100)}...`;

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
          fontSize: '24px',
          marginBottom: '16px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: '600',
        }}
      >
        Olá, {expertName}
      </Heading>

      <Text
        style={{
          color: '#2D3748',
          fontSize: '18px',
          fontWeight: '500',
          marginBottom: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {notificationTitle}
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
        <Text
          style={{
            color: '#234E52',
            fontSize: '16px',
            lineHeight: '1.6',
            margin: '0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {notificationMessage}
        </Text>
      </Section>

      {actionUrl && (
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <EmailButton href={actionUrl} variant="primary" size="lg">
            {actionText}
          </EmailButton>
        </Section>
      )}

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
        Este email foi enviado pela Eleva Care. Se não esperava receber este email, pode ignorá-lo
        com segurança.
      </Text>
    </EmailLayout>
  );
};

export default ExpertNotificationEmail;

// Sample data for React Email preview
ExpertNotificationEmail.PreviewProps = {
  expertName: 'Dr. Maria Santos',
  notificationTitle: 'New Appointment Request',
  notificationMessage:
    'You have received a new appointment request from João Silva for a cardiology consultation. The client is requesting a 60-minute consultation for next Tuesday at 2:30 PM. Please review the request and confirm your availability.',
  actionUrl: 'https://eleva.care/dashboard/appointments',
  actionText: 'View Appointments',
} as ExpertNotificationEmailProps;
