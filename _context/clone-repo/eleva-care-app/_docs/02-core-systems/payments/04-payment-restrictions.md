# Payment Method Restrictions & Timing Windows

This document outlines the payment method availability rules and timing windows implemented in the Eleva Care booking system.

## Overview

The platform implements intelligent payment method selection based on appointment timing to balance user convenience with payment processing requirements. This ensures optimal user experience while meeting Stripe's technical constraints and business requirements.

## Payment Method Rules

### 72-Hour Rule

The system uses a **72-hour cutoff** to determine which payment methods are available:

#### Appointments ≤ 72 Hours Away

- **Available Methods**: Credit/Debit Card only
- **Payment Window**: 30 minutes
- **Reason**: Immediate confirmation required for last-minute bookings
- **User Experience**: Instant booking confirmation

#### Appointments > 72 Hours Away

- **Available Methods**: Credit/Debit Card + Multibanco
- **Payment Window**: 24 hours
- **Reason**: Sufficient time for delayed payment processing
- **User Experience**: Flexible payment options with slot reservation

## Technical Implementation

### Payment Method Selection Logic

```typescript
// In /api/create-payment-intent/route.ts
const hoursUntilMeeting = (meetingDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

if (hoursUntilMeeting <= 72) {
  // Quick booking: Card only
  paymentMethodTypes = ['card'];
  paymentExpiresAt = new Date(currentTime.getTime() + 30 * 60 * 1000); // 30 minutes
} else {
  // Advance booking: Card + Multibanco
  paymentMethodTypes = ['card', 'multibanco'];
  paymentExpiresAt = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours
}
```

### Stripe Configuration

#### Multibanco Settings

- **Minimum Expiration**: 1 day (Stripe requirement)
- **Maximum Expiration**: 7 days (Stripe limit)
- **Implementation**: Uses Stripe's native 1-day minimum with 24-hour business logic

```typescript
payment_method_options: {
  multibanco: {
    expires_after_days: 1, // Minimum allowed by Stripe
  },
}
```

### Slot Reservation System

For advance bookings with delayed payment methods:

1. **Slot Hold**: 24-hour reservation created
2. **Payment Window**: Customer has 24 hours to complete payment
3. **Automatic Cleanup**: Expired reservations automatically removed
4. **Conflict Prevention**: Prevents double-bookings during payment process

## User Experience

### Checkout Notifications

When Multibanco is not available (≤72 hours), users see:

> ⚠️ **Payment Notice:** Multibanco payments are not available for appointments scheduled within 72 hours. Only credit/debit card payments are accepted for immediate booking confirmation.

### Appointment Management UI

Pending reservations display:

- **Countdown Timer**: Shows time remaining in hours (e.g., "5h", "2h")
- **Expiration Warning**: "Expiring Soon" notice when ≤2 hours remain
- **Clear Status**: Visual distinction between confirmed appointments and pending reservations

## Benefits

### For Users

- **Clear Communication**: Transparent payment method availability
- **Appropriate Options**: Right payment method for the timing
- **No Confusion**: Clear explanations when options are limited

### For Business

- **Reduced Risk**: Immediate confirmation for urgent bookings
- **Flexible Options**: Multiple payment methods for advance planning
- **Better Conversion**: Appropriate payment windows for each scenario

### For System

- **Stripe Compliance**: Works within Stripe's technical constraints
- **Simplified Logic**: No complex programmatic cancellations needed
- **Consistent Behavior**: Aligned timing across all systems

## Configuration

### Environment Variables

- Payment timing is configured in the application code
- No additional environment variables required

### Monitoring

- Payment method selection logged for each checkout
- Reservation expiration tracked in appointment management
- Cleanup statistics available in cron job logs

## Edge Cases & Considerations

### Timezone Handling

- All calculations use UTC timestamps
- User's local timezone for display only
- Consistent behavior across timezones

### System Maintenance

- Cleanup jobs handle expired reservations automatically
- No manual intervention required
- Detailed logging for monitoring

### Failed Payments

- Standard Stripe webhook handling
- Automatic cleanup of failed reservations
- User notifications as appropriate

## Future Enhancements

Potential improvements to consider:

- **Dynamic Timing**: Configurable cutoff periods
- **Payment Method Expansion**: Additional delayed payment methods
- **Regional Rules**: Country-specific payment method rules
- **Enhanced Notifications**: Real-time payment status updates

## Related Documentation

- [Stripe Integration](./stripe-payout-settings.md)
- [Cron Jobs](./cron-jobs.md)
- [Payment Transfers](./PAYMENT_TRANSFERS.md)
- [API Documentation](./api-documentation.md)
- [Payment Policies (Legal)](../content/payment-policies/) - Comprehensive user-facing documentation

## Legal Documentation & User Resources

### Payment Policies Documentation

The platform provides comprehensive, multilingual payment policy documentation accessible to all users through the website's legal navigation. These policies provide detailed explanations of payment processes, user rights, and business practices.

#### Accessibility

Payment policies are available in 4 languages:

- **English**: `/en/legal/payment-policies`
- **Portuguese**: `/pt/legal/payment-policies`
- **Spanish**: `/es/legal/payment-policies`
- **Brazilian Portuguese**: `/br/legal/payment-policies`

#### Content Coverage

The payment policies documentation includes detailed sections on:

1. **Payment Methods**: Supported payment types and availability
2. **Multibanco Policies**: Specific rules for Portuguese bank transfer payments
3. **Conflict Resolution**: Automatic conflict detection and refund procedures
4. **Refund Structure**: Clear explanation of 90%/10% refund policy
5. **Security & Compliance**: Data protection and regulatory compliance
6. **Customer Support**: Contact information and support procedures
7. **Legal Compliance**: Regulatory framework and consumer rights

#### Integration with Technical Systems

The legal documentation is fully integrated with the platform's technical implementation:

- **Collision Detection System**: Policies align with automated conflict detection in webhooks
- **Refund Processing**: Documentation matches actual Stripe refund implementation
- **Email Notifications**: Policy explanations match automated notification content
- **Scheduling Rules**: Legal terms reflect actual expert minimum notice requirements

#### Navigation & Discovery

Users can access payment policies through:

- **Footer Navigation**: Direct links from all website pages
- **Legal Document Hub**: Centralized access at `/legal/` endpoint
- **Contextual References**: Links from payment-related pages and emails
- **Multilingual Support**: Automatic language detection and appropriate routing

#### Compliance & Updates

- **Effective Date**: May 29, 2025 (aligned with technical implementation)
- **Legal Framework**: Compliance with Portuguese consumer protection laws, EU PSD2 regulations, and GDPR
- **Version Control**: Documentation updates synchronized with technical changes
- **User Notification**: Policy changes communicated through email and platform notifications

### Benefits for Users

#### Transparency

- Clear explanation of payment timing restrictions
- Detailed refund procedures and timelines
- Comprehensive conflict resolution processes

#### Legal Protection

- Formal documentation of user rights and business obligations
- Clear dispute resolution procedures
- Regulatory compliance documentation

#### Multilingual Accessibility

- Native language support for Portuguese, Spanish, and English speakers
- Consistent policy application across all supported regions
- Cultural and linguistic adaptation of legal terms

### Technical Implementation Notes

The legal documentation system uses:

- **MDX Format**: Rich content with embedded components and formatting
- **Next.js Routing**: Automatic locale-based routing and navigation
- **Static Generation**: Fast loading and SEO optimization
- **Component Reuse**: Consistent styling with existing legal documents

This ensures that users have comprehensive access to payment policy information in their preferred language, while maintaining technical consistency with the platform's automated systems.
