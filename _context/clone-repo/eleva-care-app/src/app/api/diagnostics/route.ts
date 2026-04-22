/**
 * Comprehensive System Diagnostics API
 *
 * This endpoint provides a complete health check of all system integrations:
 * - Novu configuration and workflow status
 * - QStash configuration and scheduled jobs
 * - Webhook endpoints health
 * - Database connectivity
 * - Environment variables validation
 * - Third-party service connectivity
 *
 * Usage: GET /api/diagnostics?component=all|novu|qstash|webhooks
 */
import * as Sentry from '@sentry/nextjs';
import { checkRateLimit } from '@/lib/redis/rate-limiter';
import { runNovuDiagnostics } from '@/lib/integrations/novu/client';
import { ENV_CONFIG } from '@/config/env';
import { db } from '@/drizzle/db';
import { getScheduleStats, isQStashAvailable } from '@/lib/integrations/qstash/client';
import {
  checkAllWebhooksHealth,
  generateWebhookHealthReport,
  getWebhookConfigStatus,
} from '@/lib/webhooks/health';
import { sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

const { logger } = Sentry;

interface ComponentHealth {
  status: string;
  [key: string]: unknown;
}

interface DiagnosticsResult {
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical';
  components: {
    novu?: ComponentHealth;
    qstash?: ComponentHealth;
    webhooks?: ComponentHealth;
    database?: ComponentHealth;
    environment?: ComponentHealth;
  };
  summary: {
    total: number;
    healthy: number;
    warnings: number;
    critical: number;
  };
  recommendations: string[];
}

async function checkDatabaseHealth() {
  try {
    // Simple connectivity check
    await db.execute(sql`SELECT 1`);

    return {
      status: 'healthy' as const,
      connected: true,
      message: 'Database connection successful',
    };
  } catch (error) {
    return {
      status: 'critical' as const,
      connected: false,
      message: `Database connection failed: ${error}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkEnvironmentVariables() {
  const requiredVars = [
    'NEXT_PUBLIC_APP_URL',
    'DATABASE_URL',
    'WORKOS_API_KEY',
    'STRIPE_SECRET_KEY',
    'NOVU_SECRET_KEY',
  ];

  const optionalVars = [
    'QSTASH_TOKEN',
    'STRIPE_WEBHOOK_SECRET',
    'WORKOS_WEBHOOK_SECRET',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ];

  const missing = requiredVars.filter((varName) => !ENV_CONFIG[varName as keyof typeof ENV_CONFIG]);
  const missingOptional = optionalVars.filter(
    (varName) => !ENV_CONFIG[varName as keyof typeof ENV_CONFIG],
  );

  const status: 'healthy' | 'warning' | 'critical' = missing.length === 0 ? 'healthy' : 'critical';

  return {
    status,
    required: {
      total: requiredVars.length,
      configured: requiredVars.length - missing.length,
      missing,
    },
    optional: {
      total: optionalVars.length,
      configured: optionalVars.length - missingOptional.length,
      missing: missingOptional,
    },
    issues:
      missing.length > 0 ? [`Missing required environment variables: ${missing.join(', ')}`] : [],
    warnings:
      missingOptional.length > 0
        ? [`Missing optional environment variables: ${missingOptional.join(', ')}`]
        : [],
  };
}

async function runNovuDiagnosticsWrapper() {
  try {
    const diagnostics = await runNovuDiagnostics();
    return {
      status: diagnostics.summary.healthy ? 'healthy' : 'critical',
      ...diagnostics,
    };
  } catch (error) {
    return {
      status: 'critical',
      error: error instanceof Error ? error.message : 'Failed to run Novu diagnostics',
      initialized: false,
    };
  }
}

async function runQStashDiagnostics() {
  try {
    const stats = await getScheduleStats();
    const available = isQStashAvailable();

    const status: 'healthy' | 'warning' | 'critical' =
      available && stats.qstashAvailable ? (stats.isInSync ? 'healthy' : 'warning') : 'critical';

    return {
      status,
      available,
      ...stats,
      issues: !available
        ? ['QStash client not initialized']
        : !stats.isInSync
          ? ['Configured jobs and scheduled jobs are out of sync']
          : [],
      recommendations: !available
        ? ['Check QSTASH_TOKEN environment variable']
        : !stats.isInSync
          ? ['Run pnpm qstash:schedule to sync all jobs']
          : [],
    };
  } catch (error) {
    return {
      status: 'critical',
      error: error instanceof Error ? error.message : 'Failed to check QStash status',
      available: false,
    };
  }
}

async function runWebhookDiagnostics() {
  try {
    const baseUrl =
      ENV_CONFIG.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const results = await checkAllWebhooksHealth(baseUrl);
    const report = generateWebhookHealthReport(results);
    const configStatus = getWebhookConfigStatus();

    const status: 'healthy' | 'warning' | 'critical' =
      report.summary.unhealthy > 0
        ? 'critical'
        : report.summary.warnings > 0
          ? 'warning'
          : 'healthy';

    return {
      status,
      summary: report.summary,
      configuration: configStatus,
      endpoints: results,
      criticalIssues: report.criticalIssues,
      recommendations: report.recommendations,
    };
  } catch (error) {
    return {
      status: 'critical',
      error: error instanceof Error ? error.message : 'Failed to check webhook health',
    };
  }
}

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rl = await checkRateLimit(ip, 10, 60, 'diagnostics');
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const searchParams = request.nextUrl.searchParams;
  const component = searchParams.get('component') || 'all';
  const includeDetails = searchParams.get('details') === 'true';

  // Access control: in production require a token; in non-prod allow limited internal callers
  const diagnosticsToken = request.headers.get('x-diagnostics-token') || '';
  const hasValidToken = diagnosticsToken === (process.env.DIAGNOSTICS_TOKEN || '');
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const isTrustedUA =
    ua.includes('upstash') || ua.includes('qstash') || ua.includes('vercel') || ua.includes('cron');
  const isLocalhost = request.nextUrl.hostname === 'localhost';
  const isDevOrPreview = ENV_CONFIG.NODE_ENV !== 'production';
  const isAuthorized = hasValidToken || (isDevOrPreview && (isTrustedUA || isLocalhost));

  if (!isAuthorized) {
    return NextResponse.json(
      {
        error: 'Unauthorized access to diagnostics endpoint',
        timestamp: new Date().toISOString(),
      },
      { status: 403, headers: { 'Cache-Control': 'no-cache, no-store, max-age=0' } },
    );
  }

  if (hasValidToken) {
    logger.info(logger.fmt`Running diagnostics for: ${component}`);
  }

  const result: DiagnosticsResult = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    components: {},
    summary: {
      total: 0,
      healthy: 0,
      warnings: 0,
      critical: 0,
    },
    recommendations: [],
  };

  try {
    // Run diagnostics based on component parameter
    if (component === 'all' || component === 'environment') {
      logger.info('Checking environment variables');
      result.components.environment = await checkEnvironmentVariables();
    }

    if (component === 'all' || component === 'database') {
      logger.info('Checking database connectivity');
      result.components.database = await checkDatabaseHealth();
    }

    if (component === 'all' || component === 'novu') {
      logger.info('Checking Novu integration');
      result.components.novu = await runNovuDiagnosticsWrapper();
    }

    if (component === 'all' || component === 'qstash') {
      logger.info('Checking QStash integration');
      result.components.qstash = await runQStashDiagnostics();
    }

    if (component === 'all' || component === 'webhooks') {
      logger.info('Checking webhook endpoints');
      result.components.webhooks = await runWebhookDiagnostics();
    }

    // Calculate summary
    const componentStatuses = Object.values(result.components).map((comp) => comp.status);
    result.summary.total = componentStatuses.length;
    result.summary.healthy = componentStatuses.filter((s) => s === 'healthy').length;
    result.summary.warnings = componentStatuses.filter((s) => s === 'warning').length;
    result.summary.critical = componentStatuses.filter((s) => s === 'critical').length;

    // Determine overall status
    if (result.summary.critical > 0) {
      result.status = 'critical';
    } else if (result.summary.warnings > 0) {
      result.status = 'warning';
    } else {
      result.status = 'healthy';
    }

    // Collect recommendations
    Object.values(result.components).forEach((comp) => {
      if (comp && comp.recommendations && Array.isArray(comp.recommendations)) {
        result.recommendations.push(...comp.recommendations);
      }
    });

    // Remove duplicates
    result.recommendations = Array.from(new Set(result.recommendations));

    // Filter out detailed information if not requested
    if (!includeDetails) {
      Object.keys(result.components).forEach((key) => {
        const comp = result.components[key as keyof typeof result.components];
        if (comp && typeof comp === 'object') {
          // Keep only status and summary information
          const filtered: ComponentHealth = { status: comp.status };
          if (comp.summary) filtered.summary = comp.summary;
          if (comp.error) filtered.error = comp.error;
          if (comp.issues)
            filtered.issues = Array.isArray(comp.issues) ? comp.issues.slice(0, 3) : comp.issues;
          result.components[key as keyof typeof result.components] = filtered;
        }
      });
    }

    logger.info(logger.fmt`Diagnostics complete. Overall status: ${result.status}`);

    return NextResponse.json(result, {
      status: result.status === 'critical' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error('Diagnostics failed', { error: error instanceof Error ? error.message : String(error) });
    Sentry.captureException(error);

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 'critical',
        error: error instanceof Error ? error.message : 'Diagnostics failed',
        components: result.components,
        summary: {
          total: 1,
          healthy: 0,
          warnings: 0,
          critical: 1,
        },
        recommendations: [
          'Check server logs for detailed error information',
          'Verify all environment variables are properly configured',
          'Ensure all required services are running',
        ],
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0',
        },
      },
    );
  }
}
