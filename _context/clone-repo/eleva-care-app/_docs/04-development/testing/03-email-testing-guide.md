# 📧 Eleva Care Email Template Testing Guide

This guide explains how to test your Eleva Care email templates using Resend's testing infrastructure.

## 🎯 Resend Test Addresses

Resend provides special test addresses that simulate different delivery scenarios:

- **`delivered@resend.dev`** - ✅ Successful delivery simulation
- **`bounced@resend.dev`** - ❌ Hard bounce simulation (SMTP 550 5.1.1 "Unknown User")
- **`complained@resend.dev`** - 🚨 Spam marking simulation (received but marked as spam)

## 🚀 Quick Testing Methods

### Method 1: Browser Testing (Easiest)

Open these URLs in your browser to send test emails:

#### Basic Welcome Email

```
http://localhost:3000/api/test-email
```

#### Different Template Variants

```
# Branded template with dark mode
http://localhost:3000/api/test-email?variant=branded&darkMode=true

# High contrast accessibility template
http://localhost:3000/api/test-email?variant=default&highContrast=true

# Minimal template in Spanish
http://localhost:3000/api/test-email?variant=minimal&locale=es

# Expert notification template
http://localhost:3000/api/test-email?type=expert&userRole=expert

# Appointment reminder in Portuguese
http://localhost:3000/api/test-email?type=appointment&locale=pt
```

#### Test Different Email Types

```
# Welcome email (default)
http://localhost:3000/api/test-email?type=welcome

# Expert notification
http://localhost:3000/api/test-email?type=expert

# Appointment reminder
http://localhost:3000/api/test-email?type=appointment

# Payment confirmation
http://localhost:3000/api/test-email?type=payment
```

#### Test Bounce and Spam Scenarios

```
# Test email bounce
http://localhost:3000/api/test-email?to=bounced@resend.dev

# Test spam marking
http://localhost:3000/api/test-email?to=complained@resend.dev
```

### Method 2: curl Testing

```bash
# Basic test email
curl "http://localhost:3000/api/test-email"

# Advanced test with all parameters
curl "http://localhost:3000/api/test-email?to=delivered@resend.dev&locale=en&userRole=patient&darkMode=false&highContrast=false&variant=branded&type=welcome"

# Custom email via POST
curl -X POST "http://localhost:3000/api/test-email" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "delivered@resend.dev",
    "subject": "Custom Test Email",
    "content": "<h1>Hello!</h1><p>This is a custom test.</p>",
    "locale": "en",
    "variant": "branded"
  }'
```

### Method 3: Comprehensive Script Testing

Run the full test suite with multiple scenarios:

```bash
# Install dependencies if needed
pnpm install

# Run comprehensive email template tests
pnpm test:email
```

This will send 7 different test emails covering:

- 🎯 Welcome Email - New Patient (English)
- 🏥 Expert Notification - Spanish
- 🌙 Appointment Reminder - Dark Mode (Portuguese PT)
- ♿ High Contrast - Admin Alert (Portuguese BR)
- 📧 Payment Confirmation - Minimal Template
- 🧪 Bounce Test - System Alert
- 🚨 Spam Test - Marketing Email

## 📋 API Parameters Reference

### GET `/api/test-email` Parameters

| Parameter      | Type    | Default                | Description                                                |
| -------------- | ------- | ---------------------- | ---------------------------------------------------------- |
| `to`           | string  | `delivered@resend.dev` | Recipient email address                                    |
| `locale`       | string  | `en`                   | Language code (`en`, `es`, `pt`, `br`)                     |
| `userRole`     | string  | `patient`              | User role (`patient`, `expert`, `admin`)                   |
| `darkMode`     | boolean | `false`                | Enable dark theme                                          |
| `highContrast` | boolean | `false`                | Enable high contrast accessibility                         |
| `variant`      | string  | `default`              | Template variant (`default`, `minimal`, `branded`)         |
| `type`         | string  | `welcome`              | Email type (`welcome`, `expert`, `appointment`, `payment`) |

### POST `/api/test-email` Body

```json
{
  "to": "delivered@resend.dev",
  "subject": "Custom Subject",
  "content": "<h1>Custom HTML content</h1>",
  "locale": "en",
  "userRole": "patient",
  "darkMode": false,
  "highContrast": false,
  "variant": "default"
}
```

## 🎨 Template Variants

### 1. Default Template

- Standard Eleva Care branding
- Full feature set
- Balanced design

### 2. Minimal Template

- Clean, simplified design
- Reduced visual elements
- Faster loading

### 3. Branded Template

- Enhanced Eleva Care branding
- Premium visual treatment
- Rich color scheme

## 🌐 Multilingual Support

Test emails in all supported languages:

```bash
# English
curl "http://localhost:3000/api/test-email?locale=en"

# Spanish
curl "http://localhost:3000/api/test-email?locale=es"

# Portuguese (Portugal)
curl "http://localhost:3000/api/test-email?locale=pt"

# Portuguese (Brazil)
curl "http://localhost:3000/api/test-email?locale=br"
```

## ♿ Accessibility Testing

### High Contrast Mode

```bash
curl "http://localhost:3000/api/test-email?highContrast=true"
```

Features tested:

- ✅ High contrast colors (black/white)
- ✅ Bold font weights
- ✅ Enhanced borders
- ✅ WCAG 2.1 AA compliance

### Dark Mode

```bash
curl "http://localhost:3000/api/test-email?darkMode=true"
```

Features tested:

- ✅ Dark background colors
- ✅ Light text colors
- ✅ Adjusted logo variants
- ✅ Proper contrast ratios

## 📊 Monitoring & Analytics

### Resend Dashboard

After sending test emails, monitor them at:

```
https://resend.com/emails
```

### Email Metadata

Each test email includes tracking headers:

- `X-Test-Type`: Email type
- `X-Template-Variant`: Template variant used
- `X-User-Role`: User role
- `X-Locale`: Language code
- `X-Entity-Ref-ID`: Unique test identifier

### Tags for Analytics

Every email is tagged with:

- `environment: test`
- `source: api` or `script`
- `template-type: [variant]`
- `user-role: [role]`
- `locale: [language]`
- `email-type: [type]`

## 🔧 Local Development Setup

### 1. Environment Configuration

Create `.env.local` with your Resend API key:

```env
RESEND_API_KEY=re_your_api_key_here
```

### 2. Start Development Server

```bash
pnpm dev
```

### 3. React Email Development

Preview templates locally:

```bash
pnpm email:dev
```

## 📝 Common Test Scenarios

### User Journey Testing

```bash
# New patient welcome
curl "http://localhost:3000/api/test-email?type=welcome&userRole=patient&locale=en"

# Expert gets consultation request
curl "http://localhost:3000/api/test-email?type=expert&userRole=expert&locale=es"

# Appointment reminder
curl "http://localhost:3000/api/test-email?type=appointment&userRole=patient&locale=pt"

# Payment confirmation
curl "http://localhost:3000/api/test-email?type=payment&userRole=patient&locale=br"
```

### Accessibility Testing

```bash
# High contrast for visually impaired users
curl "http://localhost:3000/api/test-email?highContrast=true&userRole=admin"

# Dark mode for eye strain reduction
curl "http://localhost:3000/api/test-email?darkMode=true&variant=minimal"
```

### Email Client Compatibility

```bash
# Minimal template for older email clients
curl "http://localhost:3000/api/test-email?variant=minimal"

# Rich branded template for modern clients
curl "http://localhost:3000/api/test-email?variant=branded"
```

### Delivery Testing

```bash
# Test successful delivery
curl "http://localhost:3000/api/test-email?to=delivered@resend.dev"

# Test bounce handling
curl "http://localhost:3000/api/test-email?to=bounced@resend.dev"

# Test spam detection
curl "http://localhost:3000/api/test-email?to=complained@resend.dev"
```

## 🚨 Troubleshooting

### Common Issues

1. **API Key Error**

   ```
   Error: RESEND_API_KEY environment variable is required
   ```

   **Solution**: Add your Resend API key to `.env.local`

2. **Template Not Found**

   ```
   Error: Cannot find module '@/lib/email-templates/...'
   ```

   **Solution**: Ensure email template files exist and Next.js is running

3. **Rate Limiting**
   ```
   Error: Too many requests
   ```
   **Solution**: Wait between requests or use the script with built-in delays

### Debug Mode

Enable verbose logging:

```bash
DEBUG=true pnpm test:email
```

## 📈 Best Practices

1. **Test All Scenarios**: Use different locales, user roles, and template variants
2. **Monitor Deliverability**: Check bounce and spam rates in Resend dashboard
3. **Accessibility First**: Always test high contrast and screen reader compatibility
4. **Mobile Testing**: Preview emails on different devices and email clients
5. **Content Validation**: Verify translations and dynamic content rendering

## 🔗 Related Resources

- [Resend Documentation](https://resend.com/docs)
- [React Email Documentation](https://react.email)
- [Email Template Source Code](./lib/email-templates/)
- [Eleva Care Design System](./lib/email-templates/design-tokens.ts)

---

## 📞 Support

If you encounter issues with email testing:

1. Check the Resend dashboard for delivery status
2. Verify your API key and environment setup
3. Review the browser developer console for errors
4. Test with different email addresses and parameters

Happy testing! 🎉
