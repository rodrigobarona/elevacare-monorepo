/**
 * Centralized environment configuration
 * Validates and provides typed access to all environment variables
 */

/**
 * Environment configuration object with validation
 */
export const ENV_CONFIG = {
  // Node Environment
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL || '',
  AUDITLOG_DATABASE_URL: process.env.AUDITLOG_DATABASE_URL || '',

  // Unified Redis Configuration (Upstash)
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',

  // Authentication (Clerk - Legacy, being migrated to WorkOS)
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || '',
  CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET || '',

  // Clerk Core 2 (v6) Redirect URLs - Use proper naming convention
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL || '/dashboard',
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL || '/dashboard',
  NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL || '',
  NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL || '',
  // Legacy Clerk URLs - kept for backwards compatibility, now point to WorkOS routes
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/login',
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/register',
  NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL || '/',

  // Authentication (WorkOS - New)
  WORKOS_API_KEY: process.env.WORKOS_API_KEY || '',
  WORKOS_CLIENT_ID: process.env.WORKOS_CLIENT_ID || '',
  NEXT_PUBLIC_WORKOS_CLIENT_ID: process.env.NEXT_PUBLIC_WORKOS_CLIENT_ID || '',
  WORKOS_COOKIE_PASSWORD: process.env.WORKOS_COOKIE_PASSWORD || '',
  WORKOS_REDIRECT_URI: process.env.WORKOS_REDIRECT_URI || '',
  WORKOS_WEBHOOK_SECRET: process.env.WORKOS_WEBHOOK_SECRET || '',

  // Stripe Configuration
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
  // Current version: 2025-09-30.clover (Latest available: 2025-10-29.clover - not yet implemented)
  STRIPE_API_VERSION: process.env.STRIPE_API_VERSION || '2025-09-30.clover',
  STRIPE_PLATFORM_FEE_PERCENTAGE: process.env.STRIPE_PLATFORM_FEE_PERCENTAGE || '0.15',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_CONNECT_WEBHOOK_SECRET: process.env.STRIPE_CONNECT_WEBHOOK_SECRET || '',
  STRIPE_IDENTITY_WEBHOOK_SECRET: process.env.STRIPE_IDENTITY_WEBHOOK_SECRET || '',

  // QStash Configuration
  QSTASH_TOKEN: process.env.QSTASH_TOKEN || '',
  QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY || '',

  // Email Configuration
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',

  // Base URL Configuration
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',

  // Novu Configuration
  NOVU_API_KEY: process.env.NOVU_API_KEY || '',
  NOVU_SECRET_KEY: process.env.NOVU_SECRET_KEY || '',
  NOVU_BASE_URL: process.env.NOVU_BASE_URL || 'https://eu.api.novu.co',
  NOVU_SOCKET_URL: process.env.NOVU_SOCKET_URL || 'wss://eu.socket.novu.co',
  NOVU_ADMIN_SUBSCRIBER_ID: process.env.NOVU_ADMIN_SUBSCRIBER_ID || 'admin',
  NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER:
    process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER || '',

  // Posthog Configuration
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY || '',
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST || '',
  POSTHOG_API_KEY: process.env.POSTHOG_API_KEY || '',
  POSTHOG_PROJECT_ID: process.env.POSTHOG_PROJECT_ID || '',

  // BetterStack Heartbeat Configuration
  // Phase 1: Critical Financial Jobs (Currently using 2/10 heartbeats)
  BETTERSTACK_EXPERT_TRANSFERS_HEARTBEAT: process.env.BETTERSTACK_EXPERT_TRANSFERS_HEARTBEAT || '',
  BETTERSTACK_PENDING_PAYOUTS_HEARTBEAT: process.env.BETTERSTACK_PENDING_PAYOUTS_HEARTBEAT || '',

  // Phase 2: Critical Revenue Protection Jobs (Recommended: 3 more heartbeats → 5/10 total)
  BETTERSTACK_PAYMENT_REMINDERS_HEARTBEAT:
    process.env.BETTERSTACK_PAYMENT_REMINDERS_HEARTBEAT || '',
  BETTERSTACK_CLEANUP_RESERVATIONS_HEARTBEAT:
    process.env.BETTERSTACK_CLEANUP_RESERVATIONS_HEARTBEAT || '',
  BETTERSTACK_UPCOMING_PAYOUTS_HEARTBEAT: process.env.BETTERSTACK_UPCOMING_PAYOUTS_HEARTBEAT || '',

  // Phase 3: User Experience Jobs (Optional: 2 more heartbeats → 7/10 total)
  BETTERSTACK_APPOINTMENT_REMINDERS_HEARTBEAT:
    process.env.BETTERSTACK_APPOINTMENT_REMINDERS_HEARTBEAT || '',
  BETTERSTACK_APPOINTMENT_REMINDERS_1HR_HEARTBEAT:
    process.env.BETTERSTACK_APPOINTMENT_REMINDERS_1HR_HEARTBEAT || '',

  // Phase 4: Operational Jobs (Optional: 1 more heartbeat → 8/10 total)
  BETTERSTACK_TASKS_HEARTBEAT: process.env.BETTERSTACK_TASKS_HEARTBEAT || '',

  // BetterStack Status Page Configuration (for ServerStatus component)
  BETTERSTACK_API_KEY: process.env.BETTERSTACK_API_KEY || '',
  BETTERSTACK_URL: process.env.BETTERSTACK_URL || '',
} as const;

/**
 * Environment validation results
 */
interface EnvValidationResult {
  isValid: boolean;
  message: string;
  missingVars?: string[];
}

/**
 * Validate environment variables by category
 */
export const ENV_VALIDATORS = {
  /**
   * Validate database environment variables
   */
  database(): EnvValidationResult {
    const missingVars: string[] = [];

    if (!ENV_CONFIG.DATABASE_URL) missingVars.push('DATABASE_URL');
    if (!ENV_CONFIG.AUDITLOG_DATABASE_URL) missingVars.push('AUDITLOG_DATABASE_URL');

    return {
      isValid: missingVars.length === 0,
      message:
        missingVars.length > 0
          ? `Missing database environment variables: ${missingVars.join(', ')}`
          : 'Database configuration is valid',
      missingVars,
    };
  },

  /**
   * Validate unified Redis configuration
   */
  redis(): EnvValidationResult {
    const missingVars: string[] = [];

    // Check for unified Redis configuration
    if (!ENV_CONFIG.UPSTASH_REDIS_REST_URL) missingVars.push('UPSTASH_REDIS_REST_URL');
    if (!ENV_CONFIG.UPSTASH_REDIS_REST_TOKEN) missingVars.push('UPSTASH_REDIS_REST_TOKEN');

    const hasUnifiedConfig = missingVars.length === 0;

    let message = '';
    if (hasUnifiedConfig) {
      message = 'Unified Redis configuration is valid';
    } else {
      message = `Missing Redis environment variables: ${missingVars.join(', ')}. Redis cache will fall back to in-memory mode.`;
    }

    return {
      isValid: hasUnifiedConfig,
      message,
      missingVars: hasUnifiedConfig ? [] : missingVars,
    };
  },

  /**
   * Validate authentication environment variables (Clerk - Legacy)
   */
  auth(): EnvValidationResult {
    const missingVars: string[] = [];

    if (!ENV_CONFIG.CLERK_SECRET_KEY) missingVars.push('CLERK_SECRET_KEY');
    if (!ENV_CONFIG.CLERK_PUBLISHABLE_KEY) missingVars.push('CLERK_PUBLISHABLE_KEY');

    // Clerk v6 redirect URLs are optional but recommended for proper OAuth handling
    const optionalVars: string[] = [];
    if (!ENV_CONFIG.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL)
      optionalVars.push('NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL');
    if (!ENV_CONFIG.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL)
      optionalVars.push('NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL');

    return {
      isValid: missingVars.length === 0,
      message:
        missingVars.length > 0
          ? `Missing Clerk authentication environment variables: ${missingVars.join(', ')}`
          : optionalVars.length > 0
            ? `Clerk authentication configuration is valid. Optional variables for better OAuth handling: ${optionalVars.join(', ')}`
            : 'Clerk authentication configuration is valid',
      missingVars,
    };
  },

  /**
   * Validate WorkOS authentication environment variables
   */
  workos(): EnvValidationResult {
    const missingVars: string[] = [];

    // Required for server-side operations
    if (!ENV_CONFIG.WORKOS_API_KEY) missingVars.push('WORKOS_API_KEY');
    if (!ENV_CONFIG.WORKOS_CLIENT_ID) missingVars.push('WORKOS_CLIENT_ID');

    // Required for client-side operations
    if (!ENV_CONFIG.NEXT_PUBLIC_WORKOS_CLIENT_ID) missingVars.push('NEXT_PUBLIC_WORKOS_CLIENT_ID');

    // Required for session management
    if (!ENV_CONFIG.WORKOS_COOKIE_PASSWORD) missingVars.push('WORKOS_COOKIE_PASSWORD');

    // Optional but recommended
    const optionalVars: string[] = [];
    if (!ENV_CONFIG.WORKOS_REDIRECT_URI) optionalVars.push('WORKOS_REDIRECT_URI');
    if (!ENV_CONFIG.WORKOS_WEBHOOK_SECRET) optionalVars.push('WORKOS_WEBHOOK_SECRET');

    let message = '';
    if (missingVars.length > 0) {
      message = `Missing WorkOS environment variables: ${missingVars.join(', ')}`;
    } else if (optionalVars.length > 0) {
      message = `WorkOS configuration is valid. Optional variables for webhooks: ${optionalVars.join(', ')}`;
    } else {
      message = 'WorkOS configuration is complete';
    }

    return {
      isValid: missingVars.length === 0,
      message,
      missingVars,
    };
  },

  /**
   * Validate Stripe environment variables
   */
  stripe(): EnvValidationResult {
    const missingVars: string[] = [];

    if (!ENV_CONFIG.STRIPE_SECRET_KEY) missingVars.push('STRIPE_SECRET_KEY');

    return {
      isValid: missingVars.length === 0,
      message:
        missingVars.length > 0
          ? `Missing Stripe environment variables: ${missingVars.join(', ')}`
          : 'Stripe configuration is valid',
      missingVars,
    };
  },

  /**
   * Validate QStash environment variables
   */
  qstash(): EnvValidationResult {
    const missingVars: string[] = [];

    if (!ENV_CONFIG.QSTASH_TOKEN) missingVars.push('QSTASH_TOKEN');
    if (!ENV_CONFIG.QSTASH_CURRENT_SIGNING_KEY) missingVars.push('QSTASH_CURRENT_SIGNING_KEY');
    if (!ENV_CONFIG.QSTASH_NEXT_SIGNING_KEY) missingVars.push('QSTASH_NEXT_SIGNING_KEY');

    return {
      isValid: missingVars.length === 0,
      message:
        missingVars.length > 0
          ? `Missing QStash environment variables: ${missingVars.join(', ')}`
          : 'QStash configuration is valid',
      missingVars,
    };
  },

  /**
   * Validate email configuration
   */
  email(): EnvValidationResult {
    const missingVars: string[] = [];

    if (!ENV_CONFIG.RESEND_API_KEY) missingVars.push('RESEND_API_KEY');

    return {
      isValid: missingVars.length === 0,
      message:
        missingVars.length > 0
          ? `Missing email environment variables: ${missingVars.join(', ')}`
          : 'Email configuration is valid',
      missingVars,
    };
  },

  /**
   * Validate Novu environment variables
   */
  novu(): EnvValidationResult {
    const missingVars: string[] = [];

    // Check for either NOVU_API_KEY or NOVU_SECRET_KEY (legacy compatibility)
    if (!ENV_CONFIG.NOVU_API_KEY && !ENV_CONFIG.NOVU_SECRET_KEY) {
      missingVars.push('NOVU_API_KEY or NOVU_SECRET_KEY');
    }
    if (!ENV_CONFIG.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER)
      missingVars.push('NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER');

    return {
      isValid: missingVars.length === 0,
      message:
        missingVars.length > 0
          ? `Missing Novu environment variables: ${missingVars.join(', ')}`
          : 'Novu configuration is valid',
      missingVars,
    };
  },

  /**
   * Validate BetterStack Status Page environment variables
   */
  betterstackStatus(): EnvValidationResult {
    const missingVars: string[] = [];

    if (!ENV_CONFIG.BETTERSTACK_API_KEY) missingVars.push('BETTERSTACK_API_KEY');
    if (!ENV_CONFIG.BETTERSTACK_URL) missingVars.push('BETTERSTACK_URL');

    return {
      isValid: missingVars.length === 0,
      message:
        missingVars.length > 0
          ? `Missing BetterStack Status Page environment variables: ${missingVars.join(', ')}. Status indicator will not be displayed.`
          : 'BetterStack Status Page configuration is valid',
      missingVars,
    };
  },

  /**
   * Validate PostHog environment variables
   */
  posthog(): EnvValidationResult {
    const missingVars: string[] = [];

    // Client-side tracking variables (required for analytics)
    if (!ENV_CONFIG.NEXT_PUBLIC_POSTHOG_KEY) missingVars.push('NEXT_PUBLIC_POSTHOG_KEY');
    if (!ENV_CONFIG.NEXT_PUBLIC_POSTHOG_HOST) missingVars.push('NEXT_PUBLIC_POSTHOG_HOST');

    // Server-side API variables (optional, only for dashboard automation)
    const hasApiConfig = ENV_CONFIG.POSTHOG_API_KEY && ENV_CONFIG.POSTHOG_PROJECT_ID;
    const hasPartialApiConfig = ENV_CONFIG.POSTHOG_API_KEY || ENV_CONFIG.POSTHOG_PROJECT_ID;

    let message = '';
    if (missingVars.length === 0) {
      if (hasApiConfig) {
        message = 'PostHog configuration is complete (analytics + dashboard automation)';
      } else if (hasPartialApiConfig) {
        message =
          'PostHog analytics configured, but incomplete API configuration for dashboard automation';
      } else {
        message = 'PostHog analytics configured (dashboard automation not configured)';
      }
    } else {
      message = `Missing PostHog environment variables: ${missingVars.join(', ')}`;
    }

    return {
      isValid: missingVars.length === 0,
      message,
      missingVars,
    };
  },

  /**
   * Validate all critical environment variables
   */
  critical(): EnvValidationResult {
    const criticalValidations = [this.database(), this.auth(), this.stripe()];

    const missingVars: string[] = [];
    for (const validation of criticalValidations) {
      if (validation.missingVars) {
        missingVars.push(...validation.missingVars);
      }
    }

    return {
      isValid: missingVars.length === 0,
      message:
        missingVars.length > 0
          ? `Missing critical environment variables: ${missingVars.join(', ')}`
          : 'All critical environment variables are configured',
      missingVars,
    };
  },
} as const;

/**
 * Helper functions for specific environment variables
 */
export const ENV_HELPERS = {
  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return ENV_CONFIG.NODE_ENV === 'development';
  },

  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return ENV_CONFIG.NODE_ENV === 'production';
  },

  /**
   * Check if running in test mode
   */
  isTest(): boolean {
    return ENV_CONFIG.NODE_ENV === 'test';
  },

  /**
   * Get the base application URL with fallbacks
   */
  getBaseUrl(): string {
    if (ENV_CONFIG.NEXT_PUBLIC_APP_URL) {
      return ENV_CONFIG.NEXT_PUBLIC_APP_URL;
    }

    return this.isDevelopment() ? 'http://localhost:3000' : 'https://eleva.care';
  },

  /**
   * Get environment configuration summary
   */
  getEnvironmentSummary() {
    const redisValidation = ENV_VALIDATORS.redis();
    const posthogValidation = ENV_VALIDATORS.posthog();
    const workosValidation = ENV_VALIDATORS.workos();

    return {
      nodeEnv: ENV_CONFIG.NODE_ENV,
      isDevelopment: this.isDevelopment(),
      isProduction: this.isProduction(),
      hasDatabase: Boolean(ENV_CONFIG.DATABASE_URL),
      hasAuth: Boolean(ENV_CONFIG.CLERK_SECRET_KEY),
      hasWorkOS: workosValidation.isValid,
      authProvider: workosValidation.isValid ? 'WorkOS' : 'Clerk',
      hasStripe: Boolean(ENV_CONFIG.STRIPE_SECRET_KEY),
      hasRedis: redisValidation.isValid,
      redisMode: ENV_CONFIG.UPSTASH_REDIS_REST_URL ? 'unified' : 'in-memory',
      hasQStash: Boolean(ENV_CONFIG.QSTASH_TOKEN),
      hasEmail: Boolean(ENV_CONFIG.RESEND_API_KEY),
      hasNovu: Boolean(
        ENV_CONFIG.NOVU_SECRET_KEY || ENV_CONFIG.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER,
      ),
      hasPostHog: posthogValidation.isValid,
      hasPostHogAPI: Boolean(ENV_CONFIG.POSTHOG_API_KEY && ENV_CONFIG.POSTHOG_PROJECT_ID),
      baseUrl: this.getBaseUrl(),
    };
  },
} as const;
