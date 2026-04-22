/**
 * Webhook Health Monitor
 *
 * Utilities to monitor and validate webhook endpoints
 * for WorkOS, Stripe, and other integrations
 */
import { ENV_CONFIG } from '@/config/env';

export interface WebhookEndpoint {
  name: string;
  path: string;
  description: string;
  requiredEnvVars: string[];
  provider: 'workos' | 'stripe' | 'stripe-identity' | 'stripe-connect' | 'internal';
  authMethod: 'signature' | 'token' | 'none';
  expectedMethods: string[];
}

export interface WebhookHealthResult {
  endpoint: WebhookEndpoint;
  status: 'healthy' | 'unhealthy' | 'warning';
  checks: {
    endpointAccessible: boolean;
    envVarsConfigured: boolean;
    authConfigured: boolean;
    methodsSupported: boolean;
  };
  issues: string[];
  recommendations: string[];
}

/**
 * All webhook endpoints in the application
 */
export const WEBHOOK_ENDPOINTS: WebhookEndpoint[] = [
  // WorkOS Authentication Webhooks
  {
    name: 'WorkOS Webhooks',
    path: '/api/webhooks/workos',
    description: 'Handle user authentication events (user.created, user.updated, session events)',
    requiredEnvVars: [
      'WORKOS_API_KEY',
      'WORKOS_WEBHOOK_SECRET',
      'NOVU_SECRET_KEY',
    ],
    provider: 'workos',
    authMethod: 'signature',
    expectedMethods: ['POST'],
  },

  // Stripe Payment Webhooks
  {
    name: 'Stripe Main Webhooks',
    path: '/api/webhooks/stripe',
    description: 'Handle payment events (payment_intent.succeeded, checkout.session.completed)',
    requiredEnvVars: [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'NOVU_SECRET_KEY', // For notifications
    ],
    provider: 'stripe',
    authMethod: 'signature',
    expectedMethods: ['POST', 'GET'],
  },

  // Stripe Identity Webhooks
  {
    name: 'Stripe Identity Webhooks',
    path: '/api/webhooks/stripe-identity',
    description: 'Handle identity verification events (identity.verification_session.verified)',
    requiredEnvVars: ['STRIPE_SECRET_KEY', 'STRIPE_IDENTITY_WEBHOOK_SECRET'],
    provider: 'stripe-identity',
    authMethod: 'signature',
    expectedMethods: ['POST'],
  },

  // Stripe Connect Webhooks
  {
    name: 'Stripe Connect Webhooks',
    path: '/api/webhooks/stripe-connect',
    description: 'Handle Connect account events (account.updated, capability.updated)',
    requiredEnvVars: ['STRIPE_SECRET_KEY', 'STRIPE_CONNECT_WEBHOOK_SECRET'],
    provider: 'stripe-connect',
    authMethod: 'signature',
    expectedMethods: ['POST'],
  },
];

/**
 * Check the health of a single webhook endpoint
 */
export async function checkWebhookHealth(
  endpoint: WebhookEndpoint,
  baseUrl?: string,
): Promise<WebhookHealthResult> {
  const result: WebhookHealthResult = {
    endpoint,
    status: 'healthy',
    checks: {
      endpointAccessible: false,
      envVarsConfigured: false,
      authConfigured: false,
      methodsSupported: false,
    },
    issues: [],
    recommendations: [],
  };

  // 1. Check environment variables
  const missingEnvVars = endpoint.requiredEnvVars.filter((envVar) => {
    const value = process.env[envVar] || ENV_CONFIG[envVar as keyof typeof ENV_CONFIG];
    return !value || value.toString().trim() === '';
  });

  if (missingEnvVars.length === 0) {
    result.checks.envVarsConfigured = true;
  } else {
    result.issues.push(`Missing environment variables: ${missingEnvVars.join(', ')}`);
    result.recommendations.push(
      `Configure missing environment variables: ${missingEnvVars.join(', ')}`,
    );
    result.status = 'unhealthy';
  }

  // 2. Check authentication configuration
  if (endpoint.authMethod === 'signature') {
    const secretEnvVar = endpoint.requiredEnvVars.find(
      (env) => env.includes('SECRET') || env.includes('SIGNING'),
    );
    const secretValue = secretEnvVar
      ? process.env[secretEnvVar] || ENV_CONFIG[secretEnvVar as keyof typeof ENV_CONFIG]
      : null;
    if (secretEnvVar && secretValue) {
      result.checks.authConfigured = true;
    } else {
      result.issues.push('Webhook signature verification not configured');
      result.recommendations.push(`Configure webhook secret: ${secretEnvVar || 'WEBHOOK_SECRET'}`);
      result.status = 'unhealthy';
    }
  } else {
    result.checks.authConfigured = true; // No auth required or token-based
  }

  // 3. Check endpoint accessibility (if baseUrl provided)
  if (baseUrl) {
    try {
      const testUrl = `${baseUrl}${endpoint.path}`;

      // Test GET method (should return method info or 405)
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      // Consider 200, 405 (Method Not Allowed), or 401 (Unauthorized) as accessible
      // 500+ means there's a server error
      if (response.status < 500) {
        result.checks.endpointAccessible = true;

        // Check if expected methods are supported
        if (endpoint.expectedMethods.includes('GET') && response.ok) {
          result.checks.methodsSupported = true;
        } else if (response.status === 405 && endpoint.expectedMethods.includes('POST')) {
          result.checks.methodsSupported = true; // 405 for GET means POST might work
        } else {
          result.checks.methodsSupported = false;
          result.issues.push(
            `Expected methods (${endpoint.expectedMethods.join(', ')}) may not be supported`,
          );
          result.status = 'warning';
        }
      } else {
        result.issues.push(`Endpoint returned ${response.status} - server error`);
        result.recommendations.push('Check server logs for errors');
        result.status = 'unhealthy';
      }
    } catch (error) {
      result.issues.push(`Endpoint not accessible: ${error}`);
      result.recommendations.push('Check if server is running and endpoint is deployed');
      result.status = 'unhealthy';
    }
  } else {
    // Skip endpoint test but assume methods are supported if other checks pass
    result.checks.methodsSupported = true;
  }

  // 4. Provider-specific checks
  if (endpoint.provider === 'workos' || endpoint.provider === 'stripe') {
    // Check if Novu is configured for notifications
    if (!ENV_CONFIG.NOVU_SECRET_KEY) {
      result.issues.push('Novu not configured - webhook notifications will not work');
      result.recommendations.push('Configure NOVU_SECRET_KEY for webhook notifications');
      if (result.status === 'healthy') result.status = 'warning';
    }
  }

  return result;
}

/**
 * Check the health of all webhook endpoints
 */
export async function checkAllWebhooksHealth(baseUrl?: string): Promise<WebhookHealthResult[]> {
  console.log('🔗 Checking webhook health for all endpoints...\n');

  const results: WebhookHealthResult[] = [];

  for (const endpoint of WEBHOOK_ENDPOINTS) {
    console.log(`🔍 Checking ${endpoint.name}...`);

    try {
      const result = await checkWebhookHealth(endpoint, baseUrl);
      results.push(result);

      const statusEmoji =
        result.status === 'healthy' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      console.log(`   ${statusEmoji} ${result.status.toUpperCase()}`);

      if (result.issues.length > 0) {
        result.issues.forEach((issue) => console.log(`      • ${issue}`));
      }
    } catch (error) {
      console.error(`   ❌ Error checking ${endpoint.name}:`, error);
      results.push({
        endpoint,
        status: 'unhealthy',
        checks: {
          endpointAccessible: false,
          envVarsConfigured: false,
          authConfigured: false,
          methodsSupported: false,
        },
        issues: [`Health check failed: ${error}`],
        recommendations: ['Check webhook configuration and server status'],
      });
    }
  }

  return results;
}

/**
 * Generate a webhook health report
 */
export function generateWebhookHealthReport(results: WebhookHealthResult[]): {
  summary: {
    total: number;
    healthy: number;
    warnings: number;
    unhealthy: number;
  };
  criticalIssues: string[];
  recommendations: string[];
} {
  const summary = {
    total: results.length,
    healthy: results.filter((r) => r.status === 'healthy').length,
    warnings: results.filter((r) => r.status === 'warning').length,
    unhealthy: results.filter((r) => r.status === 'unhealthy').length,
  };

  const criticalIssues: string[] = [];
  const recommendations: string[] = [];

  results.forEach((result) => {
    if (result.status === 'unhealthy') {
      result.issues.forEach((issue) => {
        criticalIssues.push(`${result.endpoint.name}: ${issue}`);
      });
    }

    result.recommendations.forEach((rec) => {
      if (!recommendations.includes(rec)) {
        recommendations.push(rec);
      }
    });
  });

  return {
    summary,
    criticalIssues,
    recommendations,
  };
}

/**
 * Get webhook configuration status
 */
export function getWebhookConfigStatus() {
  const configStatus = {
    workos: {
      configured: !!(ENV_CONFIG.WORKOS_API_KEY && ENV_CONFIG.WORKOS_WEBHOOK_SECRET),
      missing: [] as string[],
    },
    stripe: {
      configured: !!(ENV_CONFIG.STRIPE_SECRET_KEY && ENV_CONFIG.STRIPE_WEBHOOK_SECRET),
      missing: [] as string[],
    },
    stripeIdentity: {
      configured: !!(ENV_CONFIG.STRIPE_SECRET_KEY && ENV_CONFIG.STRIPE_IDENTITY_WEBHOOK_SECRET),
      missing: [] as string[],
    },
    stripeConnect: {
      configured: !!(ENV_CONFIG.STRIPE_SECRET_KEY && ENV_CONFIG.STRIPE_CONNECT_WEBHOOK_SECRET),
      missing: [] as string[],
    },
    novu: {
      configured: !!ENV_CONFIG.NOVU_SECRET_KEY,
      missing: [] as string[],
    },
  };

  if (!ENV_CONFIG.WORKOS_API_KEY) configStatus.workos.missing.push('WORKOS_API_KEY');
  if (!ENV_CONFIG.WORKOS_WEBHOOK_SECRET)
    configStatus.workos.missing.push('WORKOS_WEBHOOK_SECRET');

  if (!ENV_CONFIG.STRIPE_SECRET_KEY) {
    configStatus.stripe.missing.push('STRIPE_SECRET_KEY');
    configStatus.stripeIdentity.missing.push('STRIPE_SECRET_KEY');
    configStatus.stripeConnect.missing.push('STRIPE_SECRET_KEY');
  }
  if (!ENV_CONFIG.STRIPE_WEBHOOK_SECRET) configStatus.stripe.missing.push('STRIPE_WEBHOOK_SECRET');
  if (!ENV_CONFIG.STRIPE_IDENTITY_WEBHOOK_SECRET)
    configStatus.stripeIdentity.missing.push('STRIPE_IDENTITY_WEBHOOK_SECRET');
  if (!ENV_CONFIG.STRIPE_CONNECT_WEBHOOK_SECRET)
    configStatus.stripeConnect.missing.push('STRIPE_CONNECT_WEBHOOK_SECRET');

  if (!ENV_CONFIG.NOVU_SECRET_KEY) configStatus.novu.missing.push('NOVU_SECRET_KEY');

  return configStatus;
}
