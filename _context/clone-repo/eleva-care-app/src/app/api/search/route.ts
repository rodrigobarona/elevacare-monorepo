import { expertSource, patientSource, workspaceSource } from '@/lib/source';
import { createSearchAPI } from 'fumadocs-core/search/server';

/**
 * Unified Help Center Search API (Optimized)
 *
 * Single Orama index with tag-based filtering for better performance.
 * Uses Fumadocs' createSearchAPI to build a unified search index with custom properties.
 *
 * Query Parameters:
 * - query: Search string
 * - tag: Optional tag filter (e.g., 'patient', 'expert', 'workspace')
 * - locale: Optional locale filter (e.g., 'en', 'es', 'pt', 'pt-BR')
 *
 * @example
 * GET /api/search?query=booking&tag=patient&locale=en
 *
 * @see https://fumadocs.dev/docs/headless/search/orama
 */

/**
 * Source configuration with tag identifiers
 */
const sources = [
  { source: patientSource, tag: 'patient' },
  { source: expertSource, tag: 'expert' },
  { source: workspaceSource, tag: 'workspace' },
] as const;

/**
 * Supported locales for search
 */
const locales = ['en', 'es', 'pt', 'pt-BR'] as const;

/**
 * Build unified search indexes from all documentation sources
 *
 * Each page is tagged with its source portal for filtering.
 * Creates a single Orama index instead of 4 separate ones.
 * Includes all locales for i18n support.
 */
function buildUnifiedIndexes() {
  const indexes = [];

  for (const { source, tag } of sources) {
    // Get pages for all locales
    for (const locale of locales) {
      const pages = source.getPages(locale);

      for (const page of pages) {
        indexes.push({
          id: `${tag}:${locale}:${page.url}`,
          title: page.data.title,
          description: page.data.description,
          url: page.url,
          structuredData: page.data.structuredData,
          tag, // Tag for filtering by portal
          locale, // Locale for i18n filtering
        });
      }
    }
  }

  return indexes;
}

/**
 * Create unified search API with tag and locale filtering support
 *
 * Benefits over previous implementation:
 * - Single Orama index (vs 4 separate indexes)
 * - Native tag filtering (via tag property on each index)
 * - Better memory efficiency
 * - Faster search queries
 * - i18n support with locale filtering
 *
 * Tag filtering is automatically enabled when indexes have the `tag` property.
 * Use ?tag=patient to filter by portal.
 * Use ?locale=pt to filter by language.
 */
export const { GET } = createSearchAPI('advanced', {
  indexes: buildUnifiedIndexes(),
  language: 'english', // Default language for search algorithm
});
