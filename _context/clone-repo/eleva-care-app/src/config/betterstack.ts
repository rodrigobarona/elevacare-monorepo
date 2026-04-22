/**
 * BetterStack Configuration
 *
 * This configuration file contains settings for BetterStack Uptime monitoring integration.
 * BetterStack provides uptime monitoring and status page functionality for the application.
 *
 * @see https://betterstack.com/docs/uptime/api
 */
import { ENV_CONFIG } from './env';

/**
 * BetterStack API Configuration
 *
 * Required Environment Variables:
 * - BETTERSTACK_API_KEY: Your BetterStack API key for authentication
 * - BETTERSTACK_URL: Your BetterStack status page URL (e.g., https://status.eleva.care)
 *
 * To get your API key:
 * 1. Log in to your BetterStack account
 * 2. Navigate to Settings > API Tokens
 * 3. Create a new API token with 'Read Monitors' permission
 * 4. Copy the token and add it to your .env file
 *
 * To get your status page URL:
 * 1. Navigate to Status Pages in BetterStack
 * 2. Copy the URL of your status page
 * 3. Add it to your .env file
 */
export const betterstackConfig = {
  /**
   * BetterStack API key for authentication
   */
  apiKey: ENV_CONFIG.BETTERSTACK_API_KEY || undefined,

  /**
   * BetterStack status page URL
   */
  statusPageUrl: ENV_CONFIG.BETTERSTACK_URL || undefined,

  /**
   * API endpoint for fetching monitor status
   */
  apiEndpoint: 'https://uptime.betterstack.com/api/v2/monitors',

  /**
   * Cache duration for status data (in seconds)
   * Default: 180 seconds (3 minutes)
   */
  cacheDuration: 180,
} as const satisfies {
  apiKey: string | undefined;
  statusPageUrl: string | undefined;
  apiEndpoint: string;
  cacheDuration: number;
};

/**
 * Validates that all required BetterStack configuration is present
 */
export function validateBetterStackConfig(): boolean {
  return Boolean(betterstackConfig.apiKey && betterstackConfig.statusPageUrl);
}

/**
 * Status color mapping based on monitor health
 */
export const statusColorMap = {
  allUp: 'bg-green-500',
  partialOutage: 'bg-orange-500',
  majorOutage: 'bg-destructive',
  unknown: 'bg-muted-foreground',
} as const;

/**
 * Status label mapping based on monitor health
 */
export const statusLabelMap = {
  allUp: 'All systems normal',
  partialOutage: 'Partial outage',
  majorOutage: 'Degraded performance',
  unknown: 'Unable to fetch status',
} as const;
