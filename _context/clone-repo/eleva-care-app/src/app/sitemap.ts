import { db } from '@/drizzle/db';
import { EventsTable, ProfilesTable, UsersTable } from '@/drizzle/schema';
import { locales } from '@/lib/i18n/routing';
import { and, eq, isNotNull } from 'drizzle-orm';
import { MetadataRoute } from 'next';

// Add any public routes that should be included in the sitemap
const publicRoutes: string[] = ['/', '/about', '/history'];

// Available legal documents from the dynamic route
const legalDocuments = ['terms', 'privacy', 'cookie', 'payment-policies', 'expert-agreement'];

// Trust center documents (security & compliance)
const trustDocuments = ['security', 'dpa'];

// Known usernames from your working sitemap - these will be used as fallback
// if database queries fail, ensuring the sitemap always includes the key profiles
const KNOWN_EXPERT_USERNAMES = [
  'raquelcristovao',
  'juliocastrosoares',
  'marianamateus',
  'madalenapintocoelho',
  'jessicamargarido',
  'patimota',
];

/**
 * Fetch all published user profiles with their usernames for sitemap generation
 * Using database-backed approach (WorkOS)
 */
async function getPublishedUsernames(): Promise<string[]> {
  try {
    console.log('🗺️ [Sitemap] Fetching published usernames from database...');

    // Query database for published profiles with usernames
    const publishedProfiles = await db
      .select({
        username: UsersTable.username,
      })
      .from(ProfilesTable)
      .innerJoin(UsersTable, eq(ProfilesTable.workosUserId, UsersTable.workosUserId))
      .where(and(eq(ProfilesTable.published, true), isNotNull(UsersTable.username)));

    const usernames = publishedProfiles
      .map((p) => p.username)
      .filter((username): username is string => username !== null);

    console.log(`🗺️ [Sitemap] Found ${usernames.length} published usernames`);

    // Fallback to known usernames if database query returns empty
    if (usernames.length === 0) {
      console.log(`🗺️ [Sitemap] No published profiles found, using fallback list`);
      return KNOWN_EXPERT_USERNAMES;
    }

    return usernames;
  } catch (error) {
    console.error('🗺️ [Sitemap] Error fetching published usernames:', error);
    console.log('🗺️ [Sitemap] Falling back to known expert usernames due to error');
    return KNOWN_EXPERT_USERNAMES;
  }
}

/**
 * Fetch all events for published users to generate event slug routes
 */
async function getPublishedUserEvents(): Promise<Array<{ username: string; eventSlug: string }>> {
  try {
    console.log('🗺️ [Sitemap] Fetching user events from database...');

    // Query database for events of published profiles with usernames
    const userEvents = await db
      .select({
        username: UsersTable.username,
        eventSlug: EventsTable.slug,
      })
      .from(EventsTable)
      .innerJoin(UsersTable, eq(EventsTable.workosUserId, UsersTable.workosUserId))
      .innerJoin(ProfilesTable, eq(ProfilesTable.workosUserId, UsersTable.workosUserId))
      .where(
        and(
          eq(ProfilesTable.published, true),
          eq(EventsTable.isActive, true),
          isNotNull(UsersTable.username),
        ),
      );

    const events = userEvents
      .filter((e): e is { username: string; eventSlug: string } => e.username !== null)
      .map((e) => ({ username: e.username, eventSlug: e.eventSlug }));

    console.log(`🗺️ [Sitemap] Found ${events.length} published user events`);
    return events;
  } catch (error) {
    console.error('🗺️ [Sitemap] Error fetching user events:', error);
    return [];
  }
}

/**
 * Generate alternate language URLs for a given path
 */
function generateLanguageAlternates(basePath: string): Record<string, string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return Object.fromEntries(
    locales.map((locale) => {
      const isDefaultLocale = locale === 'en';
      const localePrefix = isDefaultLocale ? '' : `/${locale}`;
      const localizedPath = basePath === '/' ? localePrefix || '/' : `${localePrefix}${basePath}`;

      return [locale, `${baseUrl}${localizedPath}`];
    }),
  );
}

/**
 * Next.js 15 Sitemap Generation
 *
 * Generates a sitemap with proper internationalization support and alternate language links.
 * Includes static routes, dynamic user profiles, user events, and legal documents.
 *
 * Features:
 * - Follows Next.js 15 sitemap best practices
 * - Proper alternate language links (hreflang)
 * - Robust fallback system for database queries
 * - No duplicate entries
 * - Production-ready error handling
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const sitemapEntries: MetadataRoute.Sitemap = [];

  try {
    // Get published usernames and their events for dynamic routes
    const [publishedUsernames, userEvents] = await Promise.all([
      getPublishedUsernames(),
      getPublishedUserEvents(),
    ]);

    // Add static public routes (/, /about, /history)
    publicRoutes.forEach((route) => {
      sitemapEntries.push({
        url: `${baseUrl}${route === '/' ? '' : route}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: route === '/' ? 1 : route === '/history' ? 0.7 : 0.8,
        alternates: {
          languages: generateLanguageAlternates(route),
        },
      });
    });

    // Add dynamic username routes (/username)
    publishedUsernames.forEach((username) => {
      const route = `/${username}`;
      sitemapEntries.push({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.9, // High priority for user profiles
        alternates: {
          languages: generateLanguageAlternates(route),
        },
      });
    });

    // Add dynamic event routes (/username/eventSlug) - booking pages
    userEvents.forEach(({ username, eventSlug }) => {
      const route = `/${username}/${eventSlug}`;
      sitemapEntries.push({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.8, // High priority for booking pages
        alternates: {
          languages: generateLanguageAlternates(route),
        },
      });
    });

    // Add legal document routes (/legal/document)
    legalDocuments.forEach((document) => {
      const route = `/legal/${document}`;
      sitemapEntries.push({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'monthly', // Legal documents change less frequently
        priority: 0.6, // Medium-low priority for legal documents
        alternates: {
          languages: generateLanguageAlternates(route),
        },
      });
    });

    // Add trust center document routes (/trust/document)
    trustDocuments.forEach((document) => {
      const route = `/trust/${document}`;
      sitemapEntries.push({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'monthly', // Trust documents change less frequently
        priority: 0.7, // Slightly higher priority than legal (security & compliance)
        alternates: {
          languages: generateLanguageAlternates(route),
        },
      });
    });

    return sitemapEntries;
  } catch (error) {
    console.error('🗺️ [Sitemap] Error generating sitemap:', error);

    // Graceful fallback: Return at least the static routes if everything fails
    publicRoutes.forEach((route) => {
      sitemapEntries.push({
        url: `${baseUrl}${route === '/' ? '' : route}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: route === '/' ? 1 : route === '/history' ? 0.7 : 0.8,
        alternates: {
          languages: generateLanguageAlternates(route),
        },
      });
    });

    legalDocuments.forEach((document) => {
      const route = `/legal/${document}`;
      sitemapEntries.push({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
        alternates: {
          languages: generateLanguageAlternates(route),
        },
      });
    });

    trustDocuments.forEach((document) => {
      const route = `/trust/${document}`;
      sitemapEntries.push({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
        alternates: {
          languages: generateLanguageAlternates(route),
        },
      });
    });

    return sitemapEntries;
  }
}
