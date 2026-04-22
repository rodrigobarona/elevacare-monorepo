# 🌍 Multibanco Payment Integration & Internationalization

> **Complete implementation guide for Multibanco payment processing with multilingual email support in the Eleva Care platform**

## 🎯 Overview

This document outlines the complete internationalization (i18n) implementation for Multibanco payment emails using next-intl, supporting multiple languages with proper locale-based content rendering for the Portuguese market.

## 📋 Prerequisites

- Understanding of Next.js and next-intl framework
- Knowledge of React Email components
- Familiarity with Stripe Multibanco payment method
- Basic understanding of the payment flow in Eleva Care

## 🔧 Architecture

### Translation System

- **Framework**: next-intl
- **Translation Files**: `messages/` directory
- **Supported Languages**:
  - English (`en.json`)
  - Portuguese (`pt.json`)
  - Spanish (`es.json`)
  - Brazilian Portuguese (`br.json`)

### Email Templates

1. **`MultibancoBookingPending.tsx`** - Initial booking confirmation with payment instructions
2. **`MultibancoPaymentReminder.tsx`** - Payment reminder emails (gentle and urgent)

### Payment Flow Integration

The Multibanco integration works seamlessly with the existing payment flow:

1. **Advance Bookings (>8 days)**: Checkout offers both Card and Multibanco options
2. **Near-term Bookings (≤8 days)**: Only Card payments to ensure immediate confirmation

### Critical Expiration Logic

**Important Fix (June 2025)**: The system correctly handles different expiration timelines:

- **Stripe Checkout Session**: 24 hours maximum (Stripe's hard limit)
- **Multibanco Payment Voucher**: 7 days (handled automatically by Stripe)
- **Slot Reservation**: 7 days (our business logic, created by webhook)

Previously, there was a bug where the system tried to set 7-day expiration on Stripe Checkout Sessions, which caused the error: `"The expires_at timestamp must be less than 24 hours from Checkout Session creation."` This has been resolved by correctly separating checkout session expiration from payment completion deadlines.

## 🔧 Implementation Details

### Translation Files Structure

Each language file contains structured translations under:

```json
{
  "notifications": {
    "multibancoBookingPending": {
      "subject": "...",
      "email": {
        "preview": "...",
        "title": "...",
        "greeting": "..."
        // ... all email content keys
      }
    },
    "multibancoPaymentReminder": {
      "subject": {
        "gentle": "...",
        "urgent": "..."
      },
      "email": {
        "preview": {
          "gentle": "...",
          "urgent": "..."
        },
        "title": {
          "gentle": "...",
          "urgent": "..."
        }
        // ... conditional content based on reminder type
      }
    }
  }
}
```

### Email Component Updates

#### MultibancoBookingPending

- **Async Function**: Uses `getTranslations()` from next-intl/server
- **Namespace**: `notifications.multibancoBookingPending.email`
- **Parameter Support**: Dynamic content like `{customerName}` in greetings
- **Locale Prop**: Accepts locale parameter (defaults to 'en')

#### MultibancoPaymentReminder

- **Two-Stage Content**: Different translations for 'gentle' vs 'urgent' reminders
- **Conditional Styling**: Color schemes change based on urgency
- **Dynamic Translations**: Uses template like `t(\`title.\${reminderType}\`)`

### Key Features

#### 1. Parameter Interpolation

```typescript
t('greeting', { customerName }); // "Dear John Doe,"
t('daysRemaining', { daysRemaining: 4 }); // "You have 4 days remaining"
```

#### 2. Conditional Content

```typescript
// Different messages based on reminder urgency
const title = t(`title.${reminderType}`); // gentle vs urgent
const instructions = t(`instructions.${reminderType}`);
```

#### 3. Locale Support

```typescript
const t = await getTranslations({
  locale, // Passed from parent component
  namespace: 'notifications.multibancoBookingPending.email',
});
```

#### 4. Cultural Adaptation

- **Portuguese**: "Caro/a" for gender-neutral addressing
- **Spanish**: "Estimado/a" for formal addressing
- **Payment Methods**: Localized banking terminology (Homebanking vs Internet Banking)

## 💡 Usage Examples

### Basic Email Rendering

```typescript
const email = await MultibancoBookingPending({
  customerName: 'João Silva',
  expertName: 'Dr. Maria Santos',
  locale: 'pt', // Portuguese
  // ... other props
});
```

### Reminder Email with Urgency

```typescript
const reminderEmail = await MultibancoPaymentReminder({
  customerName: 'María García',
  reminderType: 'urgent',
  daysRemaining: 1,
  locale: 'es', // Spanish
  // ... other props
});
```

## 🔧 Integration Points

### CRON Job Integration

The payment reminder system (`send-payment-reminders/route.ts`) automatically detects user locale from:

1. User profile settings
2. Browser locale detection
3. Default fallback to English

### Email Service Integration

When sending emails via Resend:

```typescript
await sendEmail({
  to: customerEmail,
  subject: await getTranslations({
    locale,
    namespace: 'notifications.multibancoBookingPending',
  })('subject'),
  html: render(await MultibancoBookingPending({ ...props, locale })),
});
```

## 🔧 Translation Management

### Adding New Languages

1. Create new message file: `messages/{languageCode}.json`
2. Copy structure from `en.json`
3. Translate all text content
4. Update locale detection in email sending logic

### Key Translation Guidelines

- **Consistency**: Use same terminology across all emails
- **Cultural Sensitivity**: Adapt greetings and formality levels
- **Technical Terms**: Keep payment-specific terms accurate (Entity, Reference, etc.)
- **Urgency Indicators**: Maintain emotional impact in urgent reminders

## 💡 Benefits

### User Experience

- **Native Language**: Customers receive emails in their preferred language
- **Cultural Appropriateness**: Localized greetings and communication style
- **Clear Instructions**: Payment methods explained in familiar terms

### Business Impact

- **Reduced Support**: Fewer questions due to language barriers
- **Higher Conversion**: Better understanding leads to more completed payments
- **Professional Image**: Multilingual support demonstrates international readiness

### Developer Experience

- **Type Safety**: Full TypeScript support with proper typing
- **Maintainability**: Centralized translation management
- **Scalability**: Easy to add new languages without code changes

## 🔍 Troubleshooting

### Common Issues

**Missing Translations**

- Check if the key exists in all language files
- Verify namespace structure is consistent
- Use fallback to English if translation missing

**Locale Detection Issues**

- Verify locale is passed correctly to email components
- Check payment intent metadata for locale information
- Ensure fallback to 'en' is working

**Email Rendering Problems**

- Test with different locales in development
- Verify React Email component async rendering
- Check for parameter interpolation errors

## 🔗 Related Documentation

- [Payment Flow Analysis](./01-payment-flow-analysis.md)
- [Stripe Integration](./02-stripe-integration.md)
- [Multibanco Reminder System](./06-multibanco-reminder-system.md)
- Next.js Internationalization docs
- React Email documentation

## 🚀 Future Enhancements

### Potential Improvements

1. **Right-to-Left (RTL)** support for Arabic markets
2. **Currency Localization** for different regions
3. **Date/Time Formatting** based on locale preferences
4. **Dynamic Content** based on regional regulations

### Implementation Considerations

- **Translation Services**: Integration with professional translation APIs
- **Content Management**: Admin interface for translation updates
- **A/B Testing**: Compare conversion rates across different language versions
- **Analytics**: Track engagement metrics by locale

### Email Template Components

The system includes two main email template components:

- **`MultibancoBookingPending.tsx`** - Sent when Multibanco payment is created
- **`MultibancoPaymentReminder.tsx`** - Sent for payment reminders (Day 3 & 6)

Both components use async functions with `getTranslations()` from `next-intl/server` for proper server-side rendering with translations.

### Enhanced Email Integration

**`AppointmentConfirmation.tsx` Integration**: The existing appointment confirmation email component has been updated to use the centralized next-intl system instead of hardcoded translations, ensuring consistency across all email communications.

Key improvements:

- Removed 200+ lines of hardcoded translations
- Uses centralized `messages/*.json` files
- Consistent translation keys across all email templates
- Supports dynamic parameter interpolation (`{expertName}`, `{clientName}`)
- Unified email subject handling via `generateAppointmentEmail()` function

```typescript
// Updated to use centralized translations
const { html, text, subject } = await generateAppointmentEmail({
  expertName,
  clientName,
  // ... other params
  locale: 'pt', // or 'en', 'es', 'br'
});

await sendEmail({
  to: customerEmail,
  subject, // Now uses translated subject from messages/*.json
  html,
  text,
});
```

---

**Last updated**: January 15, 2025 | **Next review**: April 15, 2025
