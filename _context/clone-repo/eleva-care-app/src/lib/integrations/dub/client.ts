'use server';

import * as Sentry from '@sentry/nextjs';
import { Dub } from 'dub';

const { logger } = Sentry;

/**
 * Dub.co URL Shortening Service Integration
 *
 * Uses the official Dub TypeScript SDK to create shortened URLs.
 * Configured for Eleva Care's go.eleva.care custom domain and
 * optimized for shortening Google Meet links with UTM tracking parameters.
 *
 * @module dub
 */

const DUB_API_KEY = process.env.DUB_API_KEY;
const DUB_DEFAULT_DOMAIN = process.env.DUB_DEFAULT_DOMAIN || 'go.eleva.care';

let dubClient: Dub | null = null;

function getDubClient(): Dub | null {
  if (!DUB_API_KEY) {
    return null;
  }
  if (!dubClient) {
    dubClient = new Dub({ token: DUB_API_KEY });
  }
  return dubClient;
}

interface CreateShortLinkOptions {
  url: string;
  expertName?: string;
  expertUsername?: string;
  customDomain?: string;
  customSlug?: string;
}

/**
 * Creates a shortened URL for Google Meet links with tracking parameters.
 *
 * Validates the URL is a Google Meet link, appends UTM parameters,
 * and shortens via the Dub.co SDK. Falls back to the original URL
 * with UTM parameters if shortening fails.
 *
 * @example
 * const shortUrl = await createShortMeetLink({
 *   url: 'https://meet.google.com/abc-defg-hij',
 *   expertName: 'Jane Smith',
 *   expertUsername: 'jane.smith',
 * });
 */
export async function createShortMeetLink(options: CreateShortLinkOptions): Promise<string> {
  const { url, expertName, expertUsername, customDomain, customSlug } = options;

  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.endsWith('meet.google.com')) {
      logger.warn('Not a valid Google Meet URL', { url });
      return url;
    }
  } catch {
    logger.warn('Invalid URL format', { url });
    return url;
  }

  const dub = getDubClient();
  if (!dub) {
    logger.warn('DUB_API_KEY not configured, returning original URL');
    return url;
  }

  const campaignName = expertName
    ? expertName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    : 'expert_appointment';

  const urlWithUtm = new URL(url);
  urlWithUtm.searchParams.append('utm_source', 'eleva_care');
  urlWithUtm.searchParams.append('utm_medium', 'calendar_invite');
  urlWithUtm.searchParams.append('utm_campaign', campaignName);
  if (expertUsername) {
    urlWithUtm.searchParams.append('utm_content', expertUsername);
  }

  try {
    const result = await dub.links.create({
      url: urlWithUtm.toString(),
      domain: customDomain || DUB_DEFAULT_DOMAIN,
      ...(customSlug && { key: customSlug }),
    });

    logger.info('Successfully created short link', { shortLink: result.shortLink });
    return result.shortLink;
  } catch (error) {
    logger.error('Error creating short link with Dub.co', { error });
    return urlWithUtm.toString();
  }
}
