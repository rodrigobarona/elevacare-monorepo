# Eleva Care Email Templates

Centralized premium email system using React Email with Eleva Care's design system, standardized header/footer components, consistent brand colors, internationalization (i18n), and theme support.

## 🎨 **Eleva Care Premium Brand Guidelines**

### **Brand Colors System**

Our email templates use the official Eleva Care color palette to maintain premium brand consistency:

```typescript
const ELEVA_COLORS = {
  primary: '#006D77', // Eleva Primary Teal - Main brand color
  primaryLight: '#00A8B8', // Enhanced contrast for dark themes
  secondary: '#F0FDFF', // Secondary Light Teal - Information sections
  success: '#22C55E', // Success Green - Confirmations & success states
  warning: '#F59E0B', // Warning Yellow - Alerts & warnings
  error: '#EF4444', // Error Red - Error messages & urgent alerts
  neutral: {
    dark: '#4A5568', // Neutral Dark - Primary body text
    light: '#718096', // Neutral Light - Secondary text & muted content
    extraLight: '#F7FAFC', // Extra light - Subtle backgrounds
  },
  background: '#F9FAFB', // Main email background
  surface: '#FFFFFF', // Card/section surfaces
  border: '#E2E8F0', // Borders & dividers
} as const;
```

### **Typography System**

Premium typography following Eleva Care's design standards:

```typescript
const ELEVA_TYPOGRAPHY = {
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: {
    h1: { fontSize: '28px', fontWeight: '600', lineHeight: '1.2' },
    h2: { fontSize: '24px', fontWeight: '600', lineHeight: '1.3' },
    h3: { fontSize: '20px', fontWeight: '600', lineHeight: '1.4' },
  },
  body: {
    large: { fontSize: '18px', lineHeight: '1.6' },
    regular: { fontSize: '16px', lineHeight: '1.6' },
    small: { fontSize: '14px', lineHeight: '1.5' },
  },
} as const;
```

### **Premium Design Principles**

1. **Healthcare Trust**: Professional, clean design that builds confidence
2. **Brand Consistency**: All elements use Eleva Care's official color palette
3. **Accessibility First**: WCAG 2.1 compliant with high contrast ratios
4. **Premium Feel**: Sophisticated spacing, typography, and visual hierarchy
5. **Cross-Platform**: Optimized for all major email clients

## 🌍 **Internationalization & Themes**

The email system supports multiple languages and both light/dark themes:

**Supported Languages:**

- English (`en`)
- Portuguese (`pt`)
- Spanish (`es`)
- Brazilian Portuguese (`br`)

**Theme Support:**

- Light theme (default) - Professional healthcare design
- Dark theme - Enhanced accessibility and user preference

**Usage Example:**

```tsx
import {
  createWelcomeEmailI18n,
  detectUserLocale,
  detectUserTheme,
  triggerWelcomeEmail,
} from '@/emails';

// Auto-detect user preferences and send email
const locale = detectUserLocale(userPreferences, acceptLanguageHeader, countryCode);
const theme = detectUserTheme(userPreferences, systemPreference);

await triggerWelcomeEmail({
  subscriberId: user.id,
  email: user.email,
  userName: user.name,
  firstName: user.firstName,
  locale,
  theme,
});
```

### Novu Integration

All email templates support multilingual workflows through Novu:

```tsx
import { EMAIL_WORKFLOWS, sendWelcomeEmailAuto } from '@/emails';

// Automatically detect user locale and theme
await sendWelcomeEmailAuto(user.id, user.email, user.name, user.firstName, {
  acceptLanguage: req.headers['accept-language'],
  countryCode: user.countryCode,
  userPreferences: user.preferences,
});
```

## 📁 **Organization**

All email templates are organized by topic for better maintainability and are now using our standardized `EmailLayout` component with i18n support:

```
emails/
├── appointments/     # Appointment-related emails
├── payments/         # Payment and billing emails (Premium Eleva branding)
├── users/           # User onboarding and account emails
│   ├── welcome-email.tsx         # Standard welcome email
│   └── welcome-email-i18n.tsx    # Internationalized welcome email
├── experts/         # Expert/provider notifications
├── notifications/   # General notification emails
├── utils/           # Email utilities and i18n system
│   ├── i18n.ts      # Internationalization utilities
│   └── novu-i18n.ts # Novu workflow integration with i18n
├── index.ts         # Main exports with i18n support
└── README.md        # This file
```

## 🚀 **Usage**

### Premium Template Structure

All templates follow this standardized pattern with Eleva Care branding:

```tsx
import { EmailButton, EmailLayout } from '@/components/emails';
import { Heading, Section, Text } from '@react-email/components';

// Import Eleva Care brand constants
const ELEVA_COLORS = {
  primary: '#006D77',
  secondary: '#F0FDFF',
  // ... rest of color system
} as const;

const ELEVA_TYPOGRAPHY = {
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  // ... rest of typography system
} as const;

export default function TemplateEmail(props) {
  const subject = 'Email Subject';
  const previewText = 'Preview text for inbox';

  return (
    <EmailLayout
      subject={subject}
      previewText={previewText}
      headerVariant="branded" // Use branded header for premium feel
      footerVariant="default"
      locale={props.locale || 'en'}
    >
      <Heading
        style={{
          ...ELEVA_TYPOGRAPHY.headings.h1,
          fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
          color: ELEVA_COLORS.primary,
        }}
      >
        Template Title
      </Heading>

      <Text
        style={{
          ...ELEVA_TYPOGRAPHY.body.regular,
          fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
          color: ELEVA_COLORS.neutral.dark,
        }}
      >
        Email content
      </Text>

      <EmailButton
        href="/action"
        style={{
          backgroundColor: ELEVA_COLORS.primary,
          color: ELEVA_COLORS.surface,
          border: `2px solid ${ELEVA_COLORS.primary}`,
          padding: '16px 32px',
          borderRadius: '8px',
          fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
          fontWeight: '600',
        }}
      >
        Action Button
      </EmailButton>
    </EmailLayout>
  );
}
```

### Available Templates

#### Appointments

- **appointment-confirmation**: Confirms scheduled appointments with meeting details
- **appointment-reminder**: Reminds patients of upcoming appointments

#### Payments

- **payment-confirmation**: Confirms successful payment processing
- **multibanco-booking-pending**: Notifies about pending Multibanco payments
- **multibanco-payment-reminder**: Urgent reminders for expiring payments

#### Users

- **welcome-email**: Standard onboarding email for new users
- **welcome-email-i18n**: Internationalized welcome email with full i18n support

#### Experts

- **expert-notification**: Notifies healthcare providers of new requests

#### Notifications

- **notification-email**: Generic notification template for various use cases

### Internationalized Templates

All templates can be used with i18n support. The `*-i18n.tsx` versions provide:

- **Automatic locale detection** from user preferences, headers, or country codes
- **Theme-aware rendering** with light/dark mode support
- **Fallback content** when translations are missing
- **Message interpolation** with variables (e.g., `{userName}`, `{amount}`)
- **RTL support** for future Arabic/Hebrew locales

Example i18n template usage:

```tsx
import { createEmailContext, createWelcomeEmailI18n } from '@/emails';

// Create email with specific locale and theme
const emailContext = await createEmailContext('pt', 'dark');
const emailComponent = await createWelcomeEmailI18n({
  userName: 'Maria Silva',
  firstName: 'Maria',
  locale: 'pt',
  theme: 'dark',
  emailContext,
});
```

## 🛠️ Development

### Prerequisites

```bash
pnpm install @react-email/components
```

### Local Development

Run the React Email preview server:

```bash
pnpm email dev
```

Then visit `http://localhost:3000` to preview templates.

### Creating New Templates

1. **Choose the appropriate topic folder** (appointments, payments, users, etc.)
2. **Use the EmailLayout wrapper** for consistent header/footer
3. **Follow the design system colors and typography**
4. **Include TypeScript interfaces** for props
5. **Add PreviewProps** for development preview
6. **Export from topic index file**

Example new template:

```tsx
// emails/appointments/new-template.tsx
import { EmailButton, EmailLayout } from '@/components/emails';
import { Heading, Text } from '@react-email/components';

interface NewTemplateProps {
  userName: string;
  // ... other props
}

export default function NewTemplate({ userName }: NewTemplateProps) {
  return (
    <EmailLayout
      subject="New Template"
      previewText="Preview text"
      headerVariant="default"
      footerVariant="default"
    >
      <Heading style={{ color: '#006D77', fontSize: '28px' }}>Hello {userName}</Heading>
      {/* Template content */}
    </EmailLayout>
  );
}

NewTemplate.PreviewProps = {
  userName: 'John Doe',
} as NewTemplateProps;
```

## 🎯 Best Practices

### Accessibility & Compliance

- **High contrast ratios** following WCAG 2.1 guidelines
- **Semantic HTML structure** with proper heading hierarchy
- **Screen reader friendly** with appropriate alt text and ARIA labels
- **Mobile responsive** design with proper viewport meta tags
- **Email client compatibility** tested across major providers

### Content Guidelines

- **Clear subject lines** that indicate email purpose
- **Descriptive preview text** for inbox scanning
- **Action-oriented CTAs** with specific button text
- **Personalization** using recipient names and context
- **Professional tone** aligned with healthcare standards

### Technical Standards

- **TypeScript interfaces** for all props
- **Consistent error handling** for missing props
- **Preview props** for development testing
- **Proper imports** from shared components
- **Inline styles** for email client compatibility

## 🔧 Integration

Templates are integrated with the application through:

- **`lib/email.ts`**: Central email generation functions
- **Resend API**: Email delivery service
- **Booking flows**: Appointment confirmations and reminders
- **Payment webhooks**: Payment status notifications
- **User onboarding**: Welcome and notification emails

All templates automatically work with existing integrations through the centralized email generation system.

## 📱 Testing

Test templates using:

- **React Email preview**: Local development server
- **Cross-client testing**: Gmail, Outlook, Apple Mail, etc.
- **Mobile testing**: iOS Mail, Android Gmail
- **Accessibility testing**: Screen readers and keyboard navigation

The standardized EmailLayout ensures consistent rendering across all email clients and devices.
