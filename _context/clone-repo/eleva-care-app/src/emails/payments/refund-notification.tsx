import * as React from 'react';
import { EmailButton, EmailLayout } from '@/components/emails';
import {
  createTableCellStyle,
  ELEVA_CARD_STYLES,
  ELEVA_COLORS,
  ELEVA_TEXT_STYLES,
} from '@/emails/utils/brand-constants';
import type { SupportedLocale } from '@/emails/utils/i18n';
import { Heading, Hr, Section, Text } from '@react-email/components';

/**
 * Props for the RefundNotificationEmail component.
 * Exported for type-safe usage in consumers.
 */
export interface RefundNotificationEmailProps {
  customerName?: string;
  expertName?: string;
  serviceName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  originalAmount?: string;
  refundAmount?: string;
  currency?: string;
  refundReason?: string;
  transactionId?: string;
  locale?: SupportedLocale;
  /** Base URL for booking links. Defaults to NEXT_PUBLIC_APP_URL or 'https://eleva.care' */
  bookingUrl?: string;
}

// Local divider style for Hr component
const DIVIDER_STYLE = {
  borderColor: ELEVA_COLORS.neutral.light,
  borderTop: '1px solid',
  margin: '24px 0',
} as const;

/**
 * Email template sent when a payment is refunded due to appointment conflicts
 * Supports i18n translations for en, pt, and es locales
 *
 * @example
 * ```tsx
 * import { RefundNotificationEmail } from '@/emails/payments/refund-notification';
 * import { render } from '@react-email/render';
 *
 * const html = render(
 *   <RefundNotificationEmail
 *     customerName="Marta Silva"
 *     expertName="Dr. Patricia Mota"
 *     serviceName="Physical Therapy Appointment"
 *     appointmentDate="Tuesday, February 3, 2026"
 *     appointmentTime="11:30 AM"
 *     originalAmount="70.00"
 *     refundAmount="70.00"
 *     currency="EUR"
 *     refundReason="time_range_overlap"
 *     transactionId="pi_3Srm1DK5Ap4Um3Sp1JZyQgo9"
 *     locale="pt"
 *   />
 * );
 * ```
 */
export const RefundNotificationEmail = ({
  // Default values aligned with English locale
  customerName = 'John Smith',
  expertName = 'Dr. Sarah Johnson',
  serviceName = 'Medical Consultation',
  appointmentDate = 'Monday, February 19, 2024',
  appointmentTime = '2:30 PM',
  originalAmount = '70.00',
  refundAmount = '70.00',
  currency = 'EUR',
  refundReason = 'time_range_overlap',
  transactionId = 'pi_example123',
  locale = 'en',
  bookingUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eleva.care',
}: RefundNotificationEmailProps) => {
  // Internationalization support
  const translations = {
    en: {
      subject: `Appointment Conflict - Full Refund Processed`,
      preview: `Your payment of ${currency} ${refundAmount} has been fully refunded`,
      title: 'Appointment Conflict',
      subtitle: 'Full Refund Processed',
      greeting: `Hello ${customerName},`,
      conflictMessage: `We regret to inform you that your appointment with ${expertName} scheduled for ${appointmentDate} at ${appointmentTime} is no longer available.`,
      reasonExplanation: {
        time_range_overlap:
          'The time slot has been booked by another client. Since this was a delayed Multibanco payment, the slot was released before your payment was received.',
        expert_blocked_date:
          'The expert has blocked this date after your booking was made. This may be due to personal commitments or schedule changes.',
        minimum_notice_violation:
          "The appointment time no longer meets the expert's minimum notice requirement.",
        unknown_conflict:
          'An unexpected scheduling conflict occurred that prevents this appointment from being fulfilled.',
      },
      refundPolicy:
        'We believe in treating our customers fairly. Under our Customer-First policy, you receive a 100% refund with no processing fees charged.',
      refundDetails: 'Refund Details',
      originalAmountLabel: 'Original Amount',
      refundAmountLabel: 'Refund Amount',
      processingFeeLabel: 'Processing Fee',
      noFee: 'No fee charged',
      transactionIdLabel: 'Transaction ID',
      whatNext: 'What happens next?',
      nextSteps:
        'The refund will be processed within 5-10 business days depending on your payment method. We invite you to book a new appointment at your convenience.',
      bookAgain: 'Book New Appointment',
      apology:
        'We sincerely apologize for any inconvenience this may have caused. Thank you for your understanding.',
      needHelp: 'Need help?',
      supportText:
        "If you have any questions about your refund, please don't hesitate to contact our support team.",
      // Appointment details labels
      appointmentDetails: 'Appointment Details',
      serviceLabel: 'Service',
      expertLabel: 'Expert',
      dateLabel: 'Date',
      timeLabel: 'Time',
    },
    pt: {
      subject: `Conflito de Agendamento - Reembolso Total Processado`,
      preview: `O seu pagamento de ${currency} ${refundAmount} foi totalmente reembolsado`,
      title: 'Conflito de Agendamento',
      subtitle: 'Reembolso Total Processado',
      greeting: `Olá ${customerName},`,
      conflictMessage: `Lamentamos informar que a sua consulta com ${expertName} agendada para ${appointmentDate} às ${appointmentTime} já não está disponível.`,
      reasonExplanation: {
        time_range_overlap:
          'O horário foi reservado por outro cliente. Como este foi um pagamento Multibanco atrasado, o horário foi libertado antes do seu pagamento ser recebido.',
        expert_blocked_date:
          'O especialista bloqueou esta data após a sua reserva ter sido feita. Isto pode dever-se a compromissos pessoais ou alterações de agenda.',
        minimum_notice_violation:
          'O horário da consulta já não cumpre o requisito de aviso prévio mínimo do especialista.',
        unknown_conflict:
          'Ocorreu um conflito de agendamento inesperado que impede a realização desta consulta.',
      },
      refundPolicy:
        'Acreditamos em tratar os nossos clientes de forma justa. Sob a nossa política Cliente-Primeiro, recebe um reembolso de 100% sem taxas de processamento.',
      refundDetails: 'Detalhes do Reembolso',
      originalAmountLabel: 'Valor Original',
      refundAmountLabel: 'Valor Reembolsado',
      processingFeeLabel: 'Taxa de Processamento',
      noFee: 'Sem taxa',
      transactionIdLabel: 'ID da Transação',
      whatNext: 'O que acontece a seguir?',
      nextSteps:
        'O reembolso será processado dentro de 5-10 dias úteis, dependendo do seu método de pagamento. Convidamo-lo a agendar uma nova consulta quando lhe for conveniente.',
      bookAgain: 'Agendar Nova Consulta',
      apology:
        'Pedimos sinceras desculpas por qualquer inconveniente causado. Obrigado pela sua compreensão.',
      needHelp: 'Precisa de ajuda?',
      supportText:
        'Se tiver alguma dúvida sobre o seu reembolso, não hesite em contactar a nossa equipa de suporte.',
      // Appointment details labels
      appointmentDetails: 'Detalhes da Consulta',
      serviceLabel: 'Serviço',
      expertLabel: 'Especialista',
      dateLabel: 'Data',
      timeLabel: 'Hora',
    },
    es: {
      subject: `Conflicto de Cita - Reembolso Total Procesado`,
      preview: `Su pago de ${currency} ${refundAmount} ha sido totalmente reembolsado`,
      title: 'Conflicto de Cita',
      subtitle: 'Reembolso Total Procesado',
      greeting: `Hola ${customerName},`,
      conflictMessage: `Lamentamos informarle que su cita con ${expertName} programada para ${appointmentDate} a las ${appointmentTime} ya no está disponible.`,
      reasonExplanation: {
        time_range_overlap:
          'El horario ha sido reservado por otro cliente. Como este fue un pago Multibanco retrasado, el horario fue liberado antes de recibir su pago.',
        expert_blocked_date:
          'El experto ha bloqueado esta fecha después de que se realizó su reserva. Esto puede deberse a compromisos personales o cambios de horario.',
        minimum_notice_violation:
          'El horario de la cita ya no cumple con el requisito de aviso mínimo del experto.',
        unknown_conflict:
          'Ocurrió un conflicto de programación inesperado que impide que esta cita se lleve a cabo.',
      },
      refundPolicy:
        'Creemos en tratar a nuestros clientes de manera justa. Bajo nuestra política Cliente-Primero, recibe un reembolso del 100% sin cargos de procesamiento.',
      refundDetails: 'Detalles del Reembolso',
      originalAmountLabel: 'Monto Original',
      refundAmountLabel: 'Monto Reembolsado',
      processingFeeLabel: 'Cargo por Procesamiento',
      noFee: 'Sin cargo',
      transactionIdLabel: 'ID de Transacción',
      whatNext: '¿Qué sucede después?',
      nextSteps:
        'El reembolso se procesará dentro de 5-10 días hábiles dependiendo de su método de pago. Le invitamos a reservar una nueva cita cuando le convenga.',
      bookAgain: 'Reservar Nueva Cita',
      apology:
        'Nos disculpamos sinceramente por cualquier inconveniente que esto pueda haber causado. Gracias por su comprensión.',
      needHelp: '¿Necesita ayuda?',
      supportText:
        'Si tiene alguna pregunta sobre su reembolso, no dude en contactar a nuestro equipo de soporte.',
      // Appointment details labels
      appointmentDetails: 'Detalles de la Cita',
      serviceLabel: 'Servicio',
      expertLabel: 'Experto',
      dateLabel: 'Fecha',
      timeLabel: 'Hora',
    },
  };

  // Runtime-validated locale lookup with fallback and type assertion for narrowing
  const t =
    locale && locale in translations
      ? translations[locale as keyof typeof translations]
      : translations.en;

  // Runtime-validated reason lookup with fallback and type assertion for narrowing
  const reasonText =
    refundReason && refundReason in t.reasonExplanation
      ? t.reasonExplanation[refundReason as keyof typeof t.reasonExplanation]
      : t.reasonExplanation.unknown_conflict;

  return (
    <EmailLayout
      subject={t.subject}
      previewText={t.preview}
      headerVariant="branded"
      footerVariant="default"
      locale={locale}
    >
      {/* Warning Banner */}
      <Section style={ELEVA_CARD_STYLES.warning}>
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading2,
            margin: '0 0 8px 0',
            textAlign: 'center' as const,
          }}
        >
          ⚠️ {t.title}
        </Heading>
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '0',
            textAlign: 'center' as const,
            fontWeight: 500,
          }}
        >
          {t.subtitle}
        </Text>
      </Section>

      {/* Greeting and Conflict Message */}
      <Section style={{ margin: '32px 0' }}>
        <Text style={{ ...ELEVA_TEXT_STYLES.bodyLarge, margin: '0 0 16px 0' }}>{t.greeting}</Text>

        <Text style={ELEVA_TEXT_STYLES.bodyRegular}>{t.conflictMessage}</Text>

        <Text style={{ ...ELEVA_TEXT_STYLES.bodyRegular, marginTop: '16px' }}>{reasonText}</Text>

        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            marginTop: '16px',
            fontStyle: 'italic',
            color: ELEVA_COLORS.neutral.dark,
          }}
        >
          {t.refundPolicy}
        </Text>
      </Section>

      <Hr style={DIVIDER_STYLE} />

      {/* Refund Details Card */}
      <Section style={ELEVA_CARD_STYLES.branded}>
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading3,
            margin: '0 0 24px 0',
            borderBottom: `2px solid ${ELEVA_COLORS.primary}`,
            paddingBottom: '12px',
          }}
        >
          💰 {t.refundDetails}
        </Heading>

        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <tbody>
            <tr>
              <td style={createTableCellStyle(true)}>{t.originalAmountLabel}</td>
              <td style={createTableCellStyle(false, 'right')}>
                {currency} {originalAmount}
              </td>
            </tr>
            <tr>
              <td style={createTableCellStyle(true)}>{t.refundAmountLabel}</td>
              <td
                style={{
                  ...createTableCellStyle(false, 'right'),
                  color: ELEVA_COLORS.success,
                  fontWeight: 600,
                }}
              >
                {currency} {refundAmount} (100%)
              </td>
            </tr>
            <tr>
              <td style={createTableCellStyle(true)}>{t.processingFeeLabel}</td>
              <td
                style={{
                  ...createTableCellStyle(false, 'right'),
                  color: ELEVA_COLORS.success,
                }}
              >
                {currency} 0.00 - {t.noFee}
              </td>
            </tr>
            {transactionId && (
              <tr>
                <td style={createTableCellStyle(true)}>{t.transactionIdLabel}</td>
                <td
                  style={{
                    ...createTableCellStyle(false, 'right'),
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                >
                  {transactionId}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {/* Appointment Details */}
      <Section style={{ ...ELEVA_CARD_STYLES.default, marginTop: '24px' }}>
        <Heading style={{ ...ELEVA_TEXT_STYLES.heading3, margin: '0 0 16px 0' }}>
          📅 {t.appointmentDetails}
        </Heading>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={createTableCellStyle(true)}>{t.serviceLabel}</td>
              <td style={createTableCellStyle(false, 'right')}>{serviceName}</td>
            </tr>
            <tr>
              <td style={createTableCellStyle(true)}>{t.expertLabel}</td>
              <td style={createTableCellStyle(false, 'right')}>{expertName}</td>
            </tr>
            <tr>
              <td style={createTableCellStyle(true)}>{t.dateLabel}</td>
              <td style={createTableCellStyle(false, 'right')}>{appointmentDate}</td>
            </tr>
            <tr>
              <td style={createTableCellStyle(true)}>{t.timeLabel}</td>
              <td style={createTableCellStyle(false, 'right')}>{appointmentTime}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Hr style={DIVIDER_STYLE} />

      {/* What Happens Next */}
      <Section style={{ margin: '24px 0' }}>
        <Heading style={{ ...ELEVA_TEXT_STYLES.heading3, margin: '0 0 16px 0' }}>
          {t.whatNext}
        </Heading>

        <Text style={ELEVA_TEXT_STYLES.bodyRegular}>{t.nextSteps}</Text>

        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            marginTop: '16px',
          }}
        >
          {t.apology}
        </Text>
      </Section>

      {/* CTA Button */}
      <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <EmailButton href={bookingUrl} variant="primary">
          {t.bookAgain}
        </EmailButton>
      </Section>

      <Hr style={DIVIDER_STYLE} />

      {/* Support Section */}
      <Section style={{ margin: '24px 0' }}>
        <Heading style={{ ...ELEVA_TEXT_STYLES.heading3, margin: '0 0 12px 0' }}>
          {t.needHelp}
        </Heading>
        <Text style={{ ...ELEVA_TEXT_STYLES.bodySmall, color: ELEVA_COLORS.neutral.dark }}>
          {t.supportText}
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default RefundNotificationEmail;
