/**
 * Content Adapter Interface
 *
 * This abstraction layer enables future migration to CMS systems
 * like Sanity or PayloadCMS without changing application routes.
 *
 * Current implementation: MDX files via Fumadocs
 * Future implementation: Sanity/PayloadCMS adapters
 */

import type { TOCItemType } from 'fumadocs-core/toc';

type TableOfContents = TOCItemType[];

/**
 * Page metadata and content structure
 */
export interface Page {
  /** Unique page identifier */
  id: string;
  /** URL slug segments */
  slug: string[];
  /** Full URL path */
  url: string;
  /** Page data including frontmatter and content */
  data: PageData;
}

/**
 * Page data structure
 */
export interface PageData {
  /** Page title from frontmatter */
  title: string;
  /** Page description from frontmatter */
  description?: string;
  /** Table of contents extracted from headings */
  toc: TableOfContents;
  /** MDX body component or HTML content */
  body: React.ComponentType;
  /** Last modified date */
  lastModified?: Date;
  /** Custom frontmatter fields */
  [key: string]: unknown;
}

/**
 * Navigation tree node for sidebar
 */
export interface NavigationNode {
  /** Node title */
  title: string;
  /** URL path (for pages) */
  url?: string;
  /** Child nodes (for folders) */
  children?: NavigationNode[];
  /** Whether this node is a folder */
  isFolder?: boolean;
}

/**
 * Content Adapter Interface
 *
 * Implement this interface to support different content sources.
 * The application uses this interface, not the concrete implementation,
 * allowing easy swapping of content sources.
 */
export interface ContentAdapter {
  /**
   * Get a single page by slug and locale
   * @param slug - URL slug segments (e.g., ['getting-started', 'profile'])
   * @param locale - Language code (e.g., 'en', 'es', 'pt', 'pt-BR')
   * @returns Page object or null if not found
   */
  getPage(slug: string[], locale: string): Promise<Page | null>;

  /**
   * Get all pages for a locale
   * @param locale - Language code
   * @returns Array of all pages
   */
  getPages(locale: string): Promise<Page[]>;

  /**
   * Get navigation tree for sidebar
   * @param locale - Language code
   * @returns Navigation tree structure
   */
  getPageTree(locale: string): Promise<NavigationNode[]>;

  /**
   * Generate static params for Next.js SSG
   * @returns Array of slug/lang combinations
   */
  generateParams(): Promise<{ slug: string[]; lang: string }[]>;
}

/**
 * MDX Adapter Implementation
 *
 * Uses Fumadocs source loader to fetch content from MDX files.
 * This is the current/default implementation.
 */
export class MDXAdapter implements ContentAdapter {
  constructor(
    private source: {
      getPage: (slug: string[] | undefined, locale: string) => Page | undefined;
      getPages: (locale: string) => Page[];
      pageTree: Record<string, NavigationNode[]>;
      generateParams: () => { slug: string[]; lang: string }[];
    }
  ) {}

  async getPage(slug: string[], locale: string): Promise<Page | null> {
    const page = this.source.getPage(slug, locale);
    return page ?? null;
  }

  async getPages(locale: string): Promise<Page[]> {
    return this.source.getPages(locale);
  }

  async getPageTree(locale: string): Promise<NavigationNode[]> {
    return this.source.pageTree[locale] ?? [];
  }

  async generateParams(): Promise<{ slug: string[]; lang: string }[]> {
    return this.source.generateParams();
  }
}

/**
 * Sanity Adapter Placeholder
 *
 * Future implementation for Sanity CMS.
 * Uncomment and implement when migrating to Sanity.
 */
// export class SanityAdapter implements ContentAdapter {
//   constructor(
//     private config: {
//       projectId: string;
//       dataset: string;
//       collection: string;
//     }
//   ) {}
//
//   async getPage(slug: string[], locale: string): Promise<Page | null> {
//     // Fetch from Sanity GROQ query
//     // const query = `*[_type == "${this.config.collection}" && slug.current == $slug && language == $locale][0]`;
//     throw new Error('SanityAdapter not implemented');
//   }
//
//   async getPages(locale: string): Promise<Page[]> {
//     throw new Error('SanityAdapter not implemented');
//   }
//
//   async getPageTree(locale: string): Promise<NavigationNode[]> {
//     throw new Error('SanityAdapter not implemented');
//   }
//
//   async generateParams(): Promise<{ slug: string[]; lang: string }[]> {
//     throw new Error('SanityAdapter not implemented');
//   }
// }

/**
 * PayloadCMS Adapter Placeholder
 *
 * Future implementation for PayloadCMS.
 * Uncomment and implement when migrating to Payload.
 */
// export class PayloadAdapter implements ContentAdapter {
//   constructor(
//     private config: {
//       apiUrl: string;
//       collection: string;
//     }
//   ) {}
//
//   async getPage(slug: string[], locale: string): Promise<Page | null> {
//     // Fetch from Payload REST API
//     throw new Error('PayloadAdapter not implemented');
//   }
//
//   async getPages(locale: string): Promise<Page[]> {
//     throw new Error('PayloadAdapter not implemented');
//   }
//
//   async getPageTree(locale: string): Promise<NavigationNode[]> {
//     throw new Error('PayloadAdapter not implemented');
//   }
//
//   async generateParams(): Promise<{ slug: string[]; lang: string }[]> {
//     throw new Error('PayloadAdapter not implemented');
//   }
// }

