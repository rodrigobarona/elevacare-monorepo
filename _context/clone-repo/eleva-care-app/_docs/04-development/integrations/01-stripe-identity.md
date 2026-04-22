# Stripe Identity & Connect Account Integration

This document outlines our implementation of Stripe Identity verification and Connect account creation for the Eleva Care platform.

## Architecture Overview

Our implementation follows a secure, sequential approach to identity verification and payment account setup:

1. **Identity Verification**: Users complete identity verification through Stripe Identity first.
2. **Connect Account Creation**: Once verified, users move forward with Connect onboarding to receive payments
3. **Payout Scheduling**: Country-specific payout delays are automatically configured based on Stripe requirements
4. **Webhook Integration**: Real-time updates via webhooks ensure our system stays in sync with verification status

## Implementation Details

### Core Components

**`lib/stripe/identity.ts`**: Core functions for identity verification and Connect account creation
**`app/api/stripe/identity/`**: API endpoints for verification flows
**`app/api/stripe/connect/`**: API endpoints for Connect account creation
**`app/api/webhooks/stripe/`**: Webhook handlers for Stripe events
**`app/(private)/account/identity/`**: User-facing pages for the verification flow

### Process Flow

1. **Start Verification**:
   - The user visits `/account/identity` and initiates verification
   - Our backend creates a Stripe Identity verification session
   - The user is redirected to Stripe's hosted verification flow

2. **Verification Callback**:
   - After completion, Stripe redirects to `/account/identity/callback`.
   - The callback page checks verification status
   - If verified, the user is redirected to the success page

3. **Create Connect Account**:
   - From the success page, the user initiates Connect account creation
   - Our backend creates a Connect account linked to the verified identity
   - The user completes the Connect Express onboarding flow

4. **Payout Scheduling**:
   - Country-specific payout delays are automatically configured based on Stripe requirements

5. **Webhook Updates**:
   - Webhooks keep our database updated with verification and account status
   - The expert setup checklist reflects completion status in real-time

## Database Schema

The `UserTable` schema includes these verification-related fields:

```sql
-- Identity Verification Fields
stripeIdentityVerificationId TEXT,
stripeIdentityVerificationStatus TEXT,
stripeIdentityVerificationLastChecked TIMESTAMP,
stripeIdentityVerified BOOLEAN DEFAULT false,

-- Connect Account Fields
stripeConnectAccountId TEXT,
stripeConnectDetailsSubmitted BOOLEAN DEFAULT false,
stripeConnectPayoutsEnabled BOOLEAN DEFAULT false,
stripeConnectChargesEnabled BOOLEAN DEFAULT false,
```

## API Endpoints

### Identity Verification

- **POST `/api/stripe/identity/verification`**: Creates a new verification session
- **GET `/api/stripe/identity/status`**: Gets the status of the current user's verification

### Connect Account

- **POST `/api/stripe/connect/create`**: Creates a Connect account for verified users
- **GET `/api/stripe/connect/balance`**: Gets the Connect account balance for the current user

### Payout Settings

Each country has specific minimum payout delay requirements enforced by Stripe. Our system automatically configures the appropriate delay when creating Connect accounts:

- **United States**: 2-day minimum delay
- **Most European countries**: 7-day minimum delay
- **Other countries**: Default 7-day minimum delay

For complete details, see [Stripe Payout Settings Documentation](docs/stripe-payout-settings.md).

### Webhooks

Our webhook handler at `/api/webhooks/stripe` processes these events:

`identity.verification_session.verified`: When verification is complete
`identity.verification_session.requires_input`: When verification requires additional information
`account.updated`: When Connect account details change

## Security Considerations

1. **Sequential Verification**: Identity must be verified before Connect account creation
2. **Metadata Tracking**: All Stripe resources include metadata for audit trails
3. **Payout Controls**: Appropriate country-specific payout settings to comply with regulations
4. **Webhook Signatures**: All webhooks are verified using Stripe signatures
5. **Database Synchronization**: Status is stored in our database for reliable access

## User Experience

The verification flow is designed to be intuitive:

1. Clear instructions before verification begins
2. Real-time status updates during the process
3. Helpful error messages for any issues
4. Seamless transition from identity verification to Connect setup

For detailed UI/UX specifications and visual references:

- [Figma Design System](https://www.figma.com/file/eleva-care/identity-verification)
- [User Flow Diagrams](https://www.figma.com/file/eleva-care/verification-flow)
- [Component Library](https://eleva-care.vercel.app/docs/components/identity)

### Edge Cases & Testing

QA should test these specific edge cases:

- Expired verification sessions (sessions expire after 24 hours)
- Network interruptions during verification
- Multiple verification attempts by the same user
- Rate-limiting behavior for repeated attempts
- Verification timeout handling

### Environment Setup

Required environment variables:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
STRIPE_CONNECT_CLIENT_ID=ca_test_...
```

### Design Guidelines

The verification UI follows our design system:

- Uses the shadcn/ui component library
- Maintains consistent branding and color schemes
- Provides clear visual feedback for each step
- Implements responsive design for all device sizes

See the [Design Documentation](https://eleva-care.vercel.app/docs/design/identity) for detailed specifications and component usage.

## Testing

To test the identity verification flow:

1. Use Stripe test mode and test credentials
2. For identity verification, use [Stripe's test images](https://stripe.com/docs/identity/test-verification)
3. For Connect, use the test account data provided in Stripe's documentation
4. Set these environment variables for testing:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_test_...
   STRIPE_CONNECT_CLIENT_ID=ca_test_...
   ```
5. Toggle test mode in the Stripe dashboard to avoid accidental charges

## Troubleshooting

Common issues and solutions:

1. **Verification Stuck**: Check the webhook logs and ensure events are being received
2. **Connect Account Not Created**: Verify identity status before Connect account creation
3. **Webhook Errors**: Check signature verification and event handling logic
4. **Missing Events**: Verify server logs for request/response data and check Stripe Dashboard for event delivery status
5. **Environment Variables**: Ensure all required environment variables are properly set and available to the application

## Future Improvements

Potential enhancements to consider:

1. Enhanced error recovery for interrupted verification flows
2. Support for additional identity verification methods
3. Localization of verification instructions
4. Analytics tracking for verification completion rates
5. Multi-locale testing suite to ensure proper translation and regional compliance
6. Automated retry mechanism for failed verification attempts
7. Custom branding options for the verification flow (when supported by Stripe)

## References

- [Stripe Identity Documentation](https://stripe.com/docs/identity)
- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
