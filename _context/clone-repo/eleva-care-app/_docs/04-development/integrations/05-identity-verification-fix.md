# Identity Verification Synchronization Fix

This directory contains scripts to fix inconsistencies between Stripe Identity and Stripe Connect verification status. These issues can occur when a user has completed identity verification in Stripe Identity but the status is not properly synced to their Stripe Connect account.

## Patricia's Specific Issue

We've created a direct fix script for Patricia's account, which shows verified in the Express Dashboard but not in the Connect Dashboard due to a synchronization issue.

## Available Solutions

### 1. Using the API Endpoint (Recommended for Admin Use)

We've created a secure admin API endpoint that can force-update a user's verification status:

```bash
curl -X POST "https://your-production-domain.com/api/internal/force-verification?clerkUserId=user_2tYRmKEdAbmZUJUDPvkIzzdnMvq&adminKey=YOUR_INTERNAL_ADMIN_KEY"
```

You'll need to set the `INTERNAL_ADMIN_KEY` environment variable and provide it in the request for security.

### 2. Using the Fix Script for Patricia's Account

Run the following command from the project root:

```bash
node scripts/fix-patricia-account.js
```

This script will:

1. Update Patricia's database record to show as verified
2. Force-update her Stripe Connect account verification status
3. Add appropriate metadata to ensure the verification stays consistent

### 3. Using the Regular Sync Endpoint

For less severe cases, you can use the regular sync endpoint:

```bash
curl -X POST "https://your-production-domain.com/api/internal/sync-identity?clerkUserId=user_2tYRmKEdAbmZUJUDPvkIzzdnMvq"
```

## Understanding the Verification Issue

The problem occurs due to inconsistencies between different Stripe systems:

1. **Stripe Identity** - Handles the ID verification process
2. **Stripe Connect** - Handles payments and must have verification synced to it
3. **Your Application Database** - Stores verification status for your app

When a verification is completed in Stripe Identity, a webhook notifies your application, which then attempts to sync this status to Stripe Connect. However, this synchronization can sometimes fail or be inconsistent due to:

- Race conditions in webhook processing
- Caching issues in Stripe's dashboard
- API response inconsistencies

Our updated code adds several safeguards:

- Multiple retry attempts with exponential backoff
- Detailed logging of synchronization attempts
- Verification of successful updates
- Special endpoints for manual intervention when needed

## How to Prevent Future Issues

1. **Monitor Webhooks**: Check webhook delivery success in the Stripe Dashboard
2. **Regular Status Checks**: Periodically check for verification status inconsistencies
3. **Use the Admin Tools**: The force-verification endpoint can resolve inconsistencies when needed

## Technical Documentation

For more details on how the verification sync works, see:

- `lib/stripe.ts` - `syncIdentityVerificationToConnect` function
- `app/api/webhooks/stripe-identity/route.ts` - Webhook handler
- `app/api/internal/sync-identity/route.ts` - Manual sync endpoint
- `app/api/internal/force-verification/route.ts` - Admin force verification endpoint
