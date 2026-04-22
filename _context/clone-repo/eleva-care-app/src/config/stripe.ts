import { STRIPE_CONNECT_COUNTRY_CODES } from '@/lib/constants/countries';
import type Stripe from 'stripe';

export const STRIPE_CONFIG = {
  // API Configuration
  // Current version: 2025-09-30.clover (Latest available: 2025-10-29.clover - not yet implemented)
  API_VERSION: process.env.STRIPE_API_VERSION || '2025-09-30.clover',
  CURRENCY: 'eur',
  PAYMENT_METHODS: ['card', 'multibanco'] as const,

  // Platform Fee Configuration
  PLATFORM_FEE_PERCENTAGE: Number(process.env.STRIPE_PLATFORM_FEE_PERCENTAGE ?? '0.15'),

  // Identity Verification Configuration
  IDENTITY: {
    ALLOWED_DOCUMENT_TYPES: ['id_card', 'passport', 'driving_license'] as const,
    WEBHOOK_EVENTS: [
      'identity.verification_session.created',
      'identity.verification_session.processing',
      'identity.verification_session.verified',
      'identity.verification_session.requires_input',
    ] as const,
  },

  // Connect Account Configuration
  CONNECT: {
    DEFAULT_COUNTRY: 'PT' as const,

    SUPPORTED_COUNTRIES: STRIPE_CONNECT_COUNTRY_CODES,

    // Minimum payout delay in days required by Stripe for new accounts
    // These values may change - refer to Stripe documentation for the latest requirements
    // https://stripe.com/docs/connect/setting-payout-schedule
    PAYOUT_DELAY_DAYS: {
      DEFAULT: 7, // Default minimum for most countries
      // Countries with specific requirements
      PT: 7, // Portugal
      ES: 7, // Spain
      IT: 7, // Italy
      FR: 7, // France
      DE: 7, // Germany
      GB: 7, // United Kingdom
      US: 2, // United States
      CA: 7, // Canada
      AU: 7, // Australia
      // More can be added as needed
    } as const,
  },

  // Webhook Configuration
  WEBHOOK_EVENTS: {
    ALLOWED_EVENTS: [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.paid',
      'invoice.payment_failed',
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
    ] as const,
  },
} as const;

// Export the supported countries list for easy access
export const STRIPE_CONNECT_SUPPORTED_COUNTRIES = STRIPE_CONFIG.CONNECT.SUPPORTED_COUNTRIES;

// Export the default country for fallbacks
export const DEFAULT_COUNTRY = STRIPE_CONFIG.CONNECT.DEFAULT_COUNTRY;

// Export the payout delay days for use in payment processing modules
export const PAYOUT_DELAY_DAYS = STRIPE_CONFIG.CONNECT.PAYOUT_DELAY_DAYS;

// Helper to get the minimum payout delay for a country
export function getMinimumPayoutDelay(countryCode: string): number {
  const upperCountry = countryCode.toUpperCase();
  // Check if we have a specific requirement for this country
  const specificDelay =
    STRIPE_CONFIG.CONNECT.PAYOUT_DELAY_DAYS[
      upperCountry as keyof typeof STRIPE_CONFIG.CONNECT.PAYOUT_DELAY_DAYS
    ];

  // Return the specific delay if found, otherwise use the default
  return typeof specificDelay === 'number'
    ? specificDelay
    : STRIPE_CONFIG.CONNECT.PAYOUT_DELAY_DAYS.DEFAULT;
}

// Shared helper functions for fee calculations
export function calculateApplicationFee(amount: number | null): number {
  if (!amount) return 0;
  return Math.floor(amount * STRIPE_CONFIG.PLATFORM_FEE_PERCENTAGE);
}

export function calculateExpertAmount(amount: number | null): number {
  if (!amount) return 0;
  return Math.floor(amount * (1 - STRIPE_CONFIG.PLATFORM_FEE_PERCENTAGE));
}

// Export types for webhook events
export type AllowedWebhookEvent = (typeof STRIPE_CONFIG.WEBHOOK_EVENTS.ALLOWED_EVENTS)[number];
export type AllowedIdentityEvent = (typeof STRIPE_CONFIG.IDENTITY.WEBHOOK_EVENTS)[number];

export const STRIPE_MODE = process.env.NEXT_PUBLIC_STRIPE_MODE || 'test';
export const isTestMode = STRIPE_MODE === 'test';

// Use this throughout your app
export const getStripeConfig = () => {
  return {
    apiVersion: process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
    apiKey: process.env.STRIPE_SECRET_KEY || '',
    publicKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    mode: STRIPE_MODE,
    // Add other config values that might differ between environments
  };
};
