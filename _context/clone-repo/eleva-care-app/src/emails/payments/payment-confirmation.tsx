import * as React from 'react';
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

interface PaymentConfirmationEmailProps {
  customerName?: string;
  expertName?: string;
  serviceName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  amount?: string;
  currency?: string;
  paymentMethod?: string;
  transactionId?: string;
  appointmentUrl?: string;
  receiptUrl?: string;
  locale?: string;
}

export const PaymentConfirmationEmail = ({
  customerName = 'João Silva',
  expertName = 'Dr. Maria Santos',
  serviceName = 'Consulta de Cardiologia',
  appointmentDate = '2024-02-15',
  appointmentTime = '10:00',
  amount = '75.00',
  currency = 'EUR',
  paymentMethod = 'Credit Card',
  transactionId = 'txn_1234567890',
  appointmentUrl = 'https://eleva.care/appointment/123',
  receiptUrl = 'https://eleva.care/receipt/123',
  locale = 'en',
}: PaymentConfirmationEmailProps) => {
  const subject = `Payment Confirmed - ${serviceName} with ${expertName}`;
  const previewText = `Your payment of ${currency} ${amount} has been successfully processed. Your appointment is confirmed.`;

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
          ✅ Payment Confirmed!
        </Heading>
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '0',
            textAlign: 'center' as const,
            fontWeight: ELEVA_TYPOGRAPHY.weights.medium,
          }}
        >
          Your appointment is secured and confirmed
        </Text>
      </Section>

      {/* Premium Personal Greeting */}
      <Section style={{ margin: '32px 0' }}>
        <Text style={{ ...ELEVA_TEXT_STYLES.bodyLarge, margin: '0 0 16px 0' }}>
          Hello {customerName},
        </Text>

        <Text style={ELEVA_TEXT_STYLES.bodyRegular}>
          Great news! Your payment has been successfully processed and your appointment with{' '}
          <strong style={{ color: ELEVA_COLORS.primary }}>{expertName}</strong> is now confirmed.
        </Text>
      </Section>

      {/* Premium Payment Details - Eleva Branded */}
      <Section style={ELEVA_CARD_STYLES.branded}>
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading3,
            margin: '0 0 24px 0',
            borderBottom: `2px solid ${ELEVA_COLORS.primary}`,
            paddingBottom: '12px',
          }}
        >
          💳 Payment Details
        </Heading>

        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <tr>
            <td style={createTableCellStyle(true)}>Service:</td>
            <td style={{ ...createTableCellStyle(false, 'right'), color: ELEVA_COLORS.primary }}>
              {serviceName}
            </td>
          </tr>
          <tr>
            <td style={createTableCellStyle(true)}>Amount:</td>
            <td
              style={{
                ...createTableCellStyle(false, 'right'),
                fontSize: '20px',
                fontWeight: ELEVA_TYPOGRAPHY.weights.bold,
                color: ELEVA_COLORS.success,
              }}
            >
              {currency} {amount}
            </td>
          </tr>
          <tr>
            <td style={createTableCellStyle(true)}>Payment Method:</td>
            <td style={createTableCellStyle(false, 'right')}>{paymentMethod}</td>
          </tr>
          <tr>
            <td style={createTableCellStyle(true)}>Transaction ID:</td>
            <td
              style={{
                ...createTableCellStyle(false, 'right'),
                fontFamily: 'monospace',
                fontSize: '14px',
              }}
            >
              {transactionId}
            </td>
          </tr>
          <tr>
            <td style={createTableCellStyle(true)}>Expert:</td>
            <td style={{ ...createTableCellStyle(false, 'right'), color: ELEVA_COLORS.primary }}>
              {expertName}
            </td>
          </tr>
          <tr>
            <td style={createTableCellStyle(true)}>Date:</td>
            <td style={createTableCellStyle(false, 'right')}>{appointmentDate}</td>
          </tr>
          <tr>
            <td style={createTableCellStyle(true)}>Time:</td>
            <td style={createTableCellStyle(false, 'right')}>{appointmentTime}</td>
          </tr>
        </table>
      </Section>

      {/* Premium Action Buttons */}
      <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            marginBottom: '24px',
          }}
        >
          Ready to join your appointment?
        </Text>

        <div style={{ margin: '16px 0' }}>
          <EmailButton
            href={appointmentUrl}
            style={{
              ...ELEVA_BUTTON_STYLES.primary,
              backgroundColor: ELEVA_COLORS.primary,
              borderColor: ELEVA_COLORS.primary,
              marginRight: '12px',
            }}
          >
            🎥 Join Appointment
          </EmailButton>

          <EmailButton href={receiptUrl} style={ELEVA_BUTTON_STYLES.secondary}>
            📄 Download Receipt
          </EmailButton>
        </div>
      </Section>

      <Hr style={{ margin: '40px 0', borderColor: ELEVA_COLORS.neutral.border }} />

      {/* Premium Support Information */}
      <Section
        style={{
          ...ELEVA_CARD_STYLES.default,
          textAlign: 'center' as const,
        }}
      >
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodySmall,
            margin: '0',
          }}
        >
          <strong style={{ color: ELEVA_COLORS.primary }}>Need assistance?</strong>
          <br />
          If you have any questions about your payment or appointment, please contact our support
          team.
        </Text>
      </Section>

      {/* Premium Thank You Message */}
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
      </Section>
    </EmailLayout>
  );
};

export default PaymentConfirmationEmail;

// Sample data for React Email preview
PaymentConfirmationEmail.PreviewProps = {
  customerName: 'João Silva',
  expertName: 'Dr. Maria Santos',
  serviceName: 'Consulta de Cardiologia',
  appointmentDate: 'Monday, February 19, 2024',
  appointmentTime: '2:30 PM - 3:30 PM',
  amount: '75.00',
  currency: 'EUR',
  paymentMethod: 'Credit Card (•••• 4242)',
  transactionId: 'TXN_123456789',
  appointmentUrl: 'https://eleva.care/appointments/123',
  receiptUrl: 'https://eleva.care/receipts/123',
} as PaymentConfirmationEmailProps;
