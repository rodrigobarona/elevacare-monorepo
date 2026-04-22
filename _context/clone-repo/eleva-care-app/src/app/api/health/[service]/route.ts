/**
 * Individual Service Health Check Endpoint
 *
 * Provides granular health checks for individual services.
 * Perfect for Better Stack status page monitoring.
 *
 * Usage:
 * - GET /api/health/stripe - Check Stripe API connectivity
 * - GET /api/health/neon-database - Check database connectivity
 * - GET /api/health/workos - Check WorkOS API connectivity
 * - etc.
 *
 * Available services:
 * - vercel
 * - neon-database
 * - audit-database
 * - stripe
 * - workos
 * - upstash-redis
 * - upstash-qstash
 * - resend
 * - posthog
 * - novu
 */
import * as Sentry from '@sentry/nextjs';
import { checkRateLimit } from '@/lib/redis/rate-limiter';
import { getAvailableServices, getServiceHealthCheck } from '@/lib/utils/server/service-health';
import { NextRequest, NextResponse } from 'next/server';

const { logger } = Sentry;

export const maxDuration = 30;

interface RouteParams {
  params: Promise<{
    service: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rl = await checkRateLimit(ip, 30, 60, 'health-check');
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { service } = await params;

    // Special endpoint to list all available services
    if (service === '_list') {
      const availableServices = getAvailableServices();
      return NextResponse.json(
        {
          services: availableServices,
          total: availableServices.length,
          baseUrl: request.nextUrl.origin,
          endpoints: availableServices.map((s) => `/api/health/${s}`),
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        },
      );
    }

    // Get the health check function for the requested service
    const healthCheckFn = getServiceHealthCheck(service);

    if (!healthCheckFn) {
      return NextResponse.json(
        {
          error: 'Service not found',
          service,
          availableServices: getAvailableServices(),
          message: `Service '${service}' is not available for health checks. Use /api/health/_list to see all available services.`,
        },
        { status: 404 },
      );
    }

    // Run the health check
    const result = await healthCheckFn();

    // Determine HTTP status code based on service health
    let httpStatus: number;
    switch (result.status) {
      case 'healthy':
        httpStatus = 200;
        break;
      case 'degraded':
        httpStatus = 200; // Still return 200 for degraded but with warning in response
        break;
      case 'down':
        httpStatus = 503;
        break;
      default:
        httpStatus = 500;
    }

    return NextResponse.json(result, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'X-Service-Name': result.service,
        'X-Service-Status': result.status,
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Service health check failed', { error });

    return NextResponse.json(
      {
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
