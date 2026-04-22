import { betterstackConfig } from '@/config/betterstack';
import type { UptimeMonitorResponse } from '@/types/betterstack';
import { getTranslations } from 'next-intl/server';

/**
 * Server Status Component
 *
 * Server-side component that fetches monitor data directly from BetterStack API.
 * This component runs on the server only, keeping the API key secure.
 *
 * Multilingual support via next-intl with translations in:
 * - English (en), Spanish (es), Portuguese (pt), Brazilian Portuguese (br)
 *
 * Note: In Next.js 15 App Router, all components are Server Components by default.
 * The bundler automatically prevents this from being imported in Client Components.
 *
 * @example
 * ```tsx
 * <ServerStatus />
 * ```
 *
 * Configuration:
 * - Uses betterstackConfig for centralized configuration
 * - Requires betterstackConfig.apiKey and betterstackConfig.statusPageUrl
 * - See config/betterstack.ts for required environment variables
 */
export async function ServerStatus() {
  // Get translations for the current locale
  const t = await getTranslations('status');

  // Return null if required configuration is not set
  if (!betterstackConfig.apiKey || !betterstackConfig.statusPageUrl) {
    return null;
  }

  let statusColor = 'bg-muted-foreground';
  let statusLabel = t('unableToFetch');

  try {
    const response = await fetch(betterstackConfig.apiEndpoint, {
      headers: {
        Authorization: `Bearer ${betterstackConfig.apiKey}`,
      },
      // Cache using centralized config duration to avoid excessive API calls
      next: { revalidate: betterstackConfig.cacheDuration },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch status');
    }

    const { data } = (await response.json()) as UptimeMonitorResponse;

    // Calculate the percentage of monitors that are "up"
    const upMonitors = data.filter((monitor) => monitor.attributes.status === 'up').length;
    const totalMonitors = data.length;

    // Handle case when no monitors are configured
    if (totalMonitors === 0) {
      statusColor = 'bg-muted-foreground';
      statusLabel = t('noMonitorsConfigured');
    } else {
      const status = upMonitors / totalMonitors;

      // Determine status color and label based on the percentage
      if (status === 0) {
        statusColor = 'bg-destructive';
        statusLabel = t('degradedPerformance');
      } else if (status < 1) {
        statusColor = 'bg-orange-500';
        statusLabel = t('partialOutage');
      } else {
        statusColor = 'bg-green-500';
        statusLabel = t('allSystemsNormal');
      }
    }
  } catch (error) {
    // Log error for monitoring but don't expose details to users
    console.error('Error fetching BetterStack status:', error);
    statusColor = 'bg-muted-foreground';
    statusLabel = t('unableToFetch');
  }

  return (
    <a
      className="flex items-center gap-3 text-xs font-medium transition-opacity hover:opacity-80"
      target="_blank"
      rel="noopener noreferrer"
      href={betterstackConfig.statusPageUrl}
      aria-label={t('ariaLabel', { status: statusLabel })}
    >
      <span className="relative flex h-2 w-2">
        {/* Animated ping effect */}
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${statusColor}`}
        />
        {/* Static dot */}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${statusColor}`} />
      </span>
      <span className="text-eleva-neutral-900">{statusLabel}</span>
    </a>
  );
}
