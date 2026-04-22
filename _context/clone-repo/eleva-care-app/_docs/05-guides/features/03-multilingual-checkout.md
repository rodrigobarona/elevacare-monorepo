# Multilingual Stripe Checkout Integration Demo

This document demonstrates how the Stripe checkout experience now supports multiple languages with proper legal document linking.

## English (en)

**Multibanco Notice:**
⚠️ **Multibanco Payment Notice:** If you choose Multibanco as your payment method, your appointment slot will be reserved for 24 hours while we wait for payment confirmation. After 24 hours, if payment is not received, we cannot guarantee the appointment will still be available. For immediate confirmation, please use a credit/debit card. [View Payment Policies](https://eleva.care/en/legal/payment-policies)

**Terms of Service:**
By proceeding with payment, you agree to our [Terms of Service](https://eleva.care/en/legal/terms-of-service) and [Payment Policies](https://eleva.care/en/legal/payment-policies).

## Portuguese (pt)

**Aviso Multibanco:**
⚠️ **Aviso de Pagamento Multibanco:** Se escolher Multibanco como método de pagamento, o seu horário de consulta será reservado por 24 horas enquanto aguardamos confirmação do pagamento. Após 24 horas, se o pagamento não for recebido, não podemos garantir que a consulta ainda estará disponível. Para confirmação imediata, use um cartão de crédito/débito. [Ver Políticas de Pagamento](https://eleva.care/pt/legal/payment-policies)

**Termos de Serviço:**
Ao prosseguir com o pagamento, concorda com os nossos [Termos de Serviço](https://eleva.care/pt/legal/terms-of-service) e [Políticas de Pagamento](https://eleva.care/pt/legal/payment-policies).

## Spanish (es)

**Aviso Multibanco:**
⚠️ **Aviso de Pago Multibanco:** Si elige Multibanco como método de pago, su horario de cita será reservado por 24 horas mientras esperamos la confirmación del pago. Después de 24 horas, si no se recibe el pago, no podemos garantizar que la cita siga disponible. Para confirmación inmediata, use una tarjeta de crédito/débito. [Ver Políticas de Pago](https://eleva.care/es/legal/payment-policies)

**Términos de Servicio:**
Al proceder con el pago, acepta nuestros [Términos de Servicio](https://eleva.care/es/legal/terms-of-service) y [Políticas de Pago](https://eleva.care/es/legal/payment-policies).

## Brazilian Portuguese (br)

**Aviso Multibanco:**
⚠️ **Aviso de Pagamento Multibanco:** Se você escolher Multibanco como método de pagamento, seu horário de consulta será reservado por 24 horas enquanto aguardamos a confirmação do pagamento. Após 24 horas, se o pagamento não for recebido, não podemos garantir que a consulta ainda estará disponível. Para confirmação imediata, use um cartão de crédito/débito. [Ver Políticas de Pagamento](https://eleva.care/br/legal/payment-policies)

**Termos de Serviço:**
Ao prosseguir com o pagamento, você concorda com nossos [Termos de Serviço](https://eleva.care/br/legal/terms-of-service) e [Políticas de Pagamento](https://eleva.care/br/legal/payment-policies).

## Technical Implementation

### Key Features

- **Dynamic Language Detection**: Automatically uses the locale from `meetingData.locale`
- **URL Construction**: Dynamically builds locale-specific URLs for legal documents
- **Conditional Display**: Shows Multibanco notice only for appointments >72 hours
- **Fallback Support**: Defaults to English if locale is not provided

### Code Structure

```typescript
// Extract locale for translations
const locale = meetingData.locale || 'en';

// Get translations for the checkout messages
const t = await getTranslations({ locale, namespace: 'Payments.checkout' });

// Construct URLs for legal pages
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eleva.care';
const paymentPoliciesUrl = `${baseUrl}/${locale}/legal/payment-policies`;
const termsUrl = `${baseUrl}/${locale}/legal/terms-of-service`;
```

### Message Keys Structure

All translations are stored in `messages/{locale}.json` under the `Payments.checkout` namespace:

- `multibancoNotice`: The Multibanco payment warning with payment policies link
- `termsOfService`: Terms of service acceptance message with both terms and payment policies links

### Stripe Checkout Integration

The implementation uses Stripe's `custom_text` feature to display:

1. **Submit button message**: Multibanco notice (only when applicable)
2. **Terms acceptance message**: Legal document links (always shown)

This ensures users have clear access to legal documentation directly from the payment interface, improving transparency and legal compliance across all supported languages.
