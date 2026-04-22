import { ENV_CONFIG } from '@/config/env';
import { workflows } from '@/config/novu';
import { Client as NovuFrameworkClient } from '@novu/framework';
import { serve } from '@novu/framework/next';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

// Create explicit Novu Framework client for Next.js 15 compatibility
// Only initialize if secret key is available (skip during build time)
const hasSecretKey = ENV_CONFIG.NOVU_SECRET_KEY && ENV_CONFIG.NOVU_SECRET_KEY.length > 0;

let handlers: ReturnType<typeof serve>;

if (hasSecretKey) {
  const client = new NovuFrameworkClient({
    secretKey: ENV_CONFIG.NOVU_SECRET_KEY!,
    strictAuthentication: false, // Allows flexible authentication for development
  });

  logger.info(logger.fmt`Novu bridge endpoint initialized with ${workflows.length} workflows`);

  // Export the handlers for the Novu framework
  // The serve function automatically handles GET, POST, and OPTIONS methods
  handlers = serve({
    client,
    workflows,
  });
} else {
  // Provide fallback handlers when Novu is not configured (e.g., during build)
  logger.warn('Novu bridge endpoint skipped - NOVU_SECRET_KEY not configured');
  const fallbackHandler = () =>
    NextResponse.json({ error: 'Novu not configured' }, { status: 503 });
  handlers = {
    GET: fallbackHandler,
    POST: fallbackHandler,
    OPTIONS: fallbackHandler,
  } as unknown as ReturnType<typeof serve>;
}

export const { GET, POST, OPTIONS } = handlers;
