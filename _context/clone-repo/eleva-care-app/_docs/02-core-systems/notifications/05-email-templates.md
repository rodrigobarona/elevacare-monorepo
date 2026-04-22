# Email Templates

> **Updated**: January 2026  
> **Framework**: React Email + Novu

## Overview

Eleva Care uses React Email templates rendered through Novu workflows. All templates support internationalization (i18n) with English, Portuguese, and Spanish.

## Template Structure

```
src/emails/
├── appointments/           # Appointment lifecycle emails
│   ├── appointment-confirmation.tsx
│   ├── appointment-reminder.tsx
│   └── index.ts
├── experts/                # Expert-specific notifications
│   ├── expert-new-appointment.tsx
│   └── index.ts
├── payments/               # Payment-related emails
│   ├── payment-confirmation.tsx
│   ├── payment-reminder.tsx
│   ├── refund-notification.tsx
│   ├── reservation-expired.tsx
│   └── index.ts
├── utils/
│   └── i18n.ts            # Shared i18n utilities
└── components/            # Reusable email components
    ├── EmailHeader.tsx
    ├── EmailFooter.tsx
    └── Button.tsx
```

## New Templates (January 2026)

### 1. Refund Notification (`refund-notification.tsx`)

Sent when an appointment conflict requires a refund.

**Props:**
```typescript
interface RefundNotificationTemplateProps {
  customerName: string;
  expertName: string;
  appointmentDate: string;
  appointmentTime: string;
  refundAmount: string;
  reason?: string;
  locale?: SupportedLocale; // 'en' | 'pt' | 'es'
}
```

**Usage:**
```typescript
import { render } from '@react-email/render';
import { RefundNotificationTemplate } from '@/emails/payments';

const html = await render(
  RefundNotificationTemplate({
    customerName: 'Maria',
    expertName: 'Dr. Silva',
    appointmentDate: '25 de Janeiro, 2026',
    appointmentTime: '14:00',
    refundAmount: '€50.00',
    locale: 'pt',
  })
);
```

### 2. Expert New Appointment (`expert-new-appointment.tsx`)

Notifies experts when they receive a new booking.

**Props:**
```typescript
interface ExpertNewAppointmentTemplateProps {
  expertName: string;
  customerName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  timezone: string;
  meetingUrl?: string;
  locale?: SupportedLocale;
}
```

**Key Difference from `appointment-confirmation.tsx`:**
- `appointment-confirmation.tsx` → Sent to **patients**
- `expert-new-appointment.tsx` → Sent to **experts**

### 3. Reservation Expired (`reservation-expired.tsx`)

Sent when a Multibanco payment reservation expires without completion.

**Props:**
```typescript
interface ReservationExpiredTemplateProps {
  recipientName: string;
  recipientType: 'patient' | 'expert';
  appointmentDate: string;
  appointmentTime: string;
  serviceName: string;
  locale?: SupportedLocale;
}
```

## i18n Implementation

All templates use the shared i18n utility:

```typescript
// src/emails/utils/i18n.ts
export type SupportedLocale = 'en' | 'pt' | 'es';

/** Generic function type for translation strings with parameters */
type TranslationFn<T extends unknown[] = []> = (...args: T) => string;

/** Email translation interface - enforces correct function signatures */
interface EmailTranslations {
  refund: {
    title: string;
    body: TranslationFn<[amount: string]>;
  };
  appointment: {
    confirmed: string;
    reminder: string;
  };
  common: {
    greeting: TranslationFn<[name: string]>;
    footer: string;
  };
}

// Translation structure for email templates with type safety
const translations: Record<SupportedLocale, EmailTranslations> = {
  en: {
    refund: {
      title: 'Refund Processed',
      body: (amount: string) => `Your refund of ${amount} has been processed.`,
    },
    appointment: {
      confirmed: 'Appointment Confirmed',
      reminder: 'Appointment Reminder',
    },
    common: {
      greeting: (name: string) => `Hello ${name},`,
      footer: 'Thank you for using Eleva Care',
    },
  },
  pt: {
    refund: {
      title: 'Reembolso Processado',
      body: (amount: string) => `O seu reembolso de ${amount} foi processado.`,
    },
    appointment: {
      confirmed: 'Consulta Confirmada',
      reminder: 'Lembrete de Consulta',
    },
    common: {
      greeting: (name: string) => `Olá ${name},`,
      footer: 'Obrigado por usar a Eleva Care',
    },
  },
  es: {
    refund: {
      title: 'Reembolso Procesado',
      body: (amount: string) => `Su reembolso de ${amount} ha sido procesado.`,
    },
    appointment: {
      confirmed: 'Cita Confirmada',
      reminder: 'Recordatorio de Cita',
    },
    common: {
      greeting: (name: string) => `Hola ${name},`,
      footer: 'Gracias por usar Eleva Care',
    },
  },
} as const;

export function getEmailTranslations(locale: SupportedLocale) {
  return translations[locale] ?? translations.en;
}
```

**Template Usage:**
```typescript
export function RefundNotificationTemplate({
  locale = 'en',
  ...props
}: RefundNotificationTemplateProps) {
  const t = getEmailTranslations(locale);

  return (
    <Html>
      <Head />
      <Body>
        <Text>{t.refund.title}</Text>
        <Text>{t.refund.body(props.refundAmount)}</Text>
      </Body>
    </Html>
  );
}
```

## Novu Integration

Templates are rendered via the `ElevaEmailService`:

```typescript
// src/lib/integrations/novu/email-service.ts
import { render } from '@react-email/render';
import {
  RefundNotificationTemplate,
  ReservationExpiredTemplate,
} from '@/emails/payments';
import { ExpertNewAppointmentTemplate } from '@/emails/experts';

class ElevaEmailService {
  async renderRefundNotification(
    props: RefundNotificationTemplateProps
  ): Promise<string> {
    return render(RefundNotificationTemplate(props));
  }

  async renderExpertNewAppointment(
    props: ExpertNewAppointmentTemplateProps
  ): Promise<string> {
    return render(ExpertNewAppointmentTemplate(props));
  }

  async renderReservationExpired(
    props: ReservationExpiredTemplateProps
  ): Promise<string> {
    return render(ReservationExpiredTemplate(props));
  }
}
```

## Testing Templates

Preview templates locally:

```bash
# Start the email preview server
bun run email:dev

# Open http://localhost:3030
```

## Adding New Templates

1. Create the template file in the appropriate folder
2. Export from the folder's `index.ts`
3. Add a render method to `ElevaEmailService` if needed
4. Add translations to `src/emails/utils/i18n.ts`
5. Test with the preview server

## Related Files

- `src/lib/integrations/novu/email-service.ts` - Service class
- `src/emails/utils/i18n.ts` - Translation utilities
- `_docs/02-core-systems/notifications/01-novu-integration.md` - Novu setup

## See Also

- [Novu Integration](./01-novu-integration.md)
- [Notification Workflows](./02-notification-workflows.md)
