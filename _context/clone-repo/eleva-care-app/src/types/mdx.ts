/**
 * Shared MDX Component Types
 *
 * Provides type-safe interfaces for dynamically imported MDX content components.
 * These types replace `React.ComponentType<any>` across page components.
 *
 * @module types/mdx
 */

import type { ComponentType, ReactNode } from 'react';

/**
 * Props interface for dynamically imported MDX content components.
 * MDX components receive a `components` prop mapping custom component names
 * to their React implementations.
 *
 * Note: We use `ComponentType<never>` as the value type because MDX components
 * can accept any component type regardless of their props. This is intentionally
 * loose to accommodate the dynamic nature of MDX component injection.
 *
 * @example
 * ```tsx
 * const mdxModule = await import(`@/content/about/${locale}.mdx`);
 * const AboutContent: MDXContentComponent = mdxModule.default;
 *
 * return <AboutContent components={{ Button, Image }} />;
 * ```
 */
export interface MDXComponentProps {
  /** Map of component names to their React implementations */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components?: Record<string, ComponentType<any>>;
  /** Optional children for wrapper components */
  children?: ReactNode;
}

/**
 * Generic MDX content component type.
 * Use this for typing dynamically imported MDX default exports.
 *
 * @example
 * ```tsx
 * let Content: MDXContentComponent;
 * try {
 *   const mdxModule = await import(`@/content/page/${locale}.mdx`);
 *   Content = mdxModule.default;
 * } catch (error) {
 *   return notFound();
 * }
 * ```
 */
export type MDXContentComponent = ComponentType<MDXComponentProps>;

/**
 * MDX metadata structure exported from MDX files.
 * Used for SEO metadata generation.
 *
 * @example
 * ```tsx
 * // In MDX file:
 * export const metadata = {
 *   title: 'About Us',
 *   description: 'Learn about our mission',
 *   og: { title: 'About | Eleva Care' }
 * };
 * ```
 */
export interface MDXMetadata {
  /** Page title for SEO */
  title: string;
  /** Page description for SEO */
  description: string;
  /** OpenGraph metadata (optional) */
  og?: {
    title?: string;
    description?: string;
    siteName?: string;
  };
}

/**
 * Type for MDX module imports with metadata.
 *
 * @example
 * ```tsx
 * const mdxModule: MDXModule = await import(`@/content/about/${locale}.mdx`);
 * const { default: Content, metadata } = mdxModule;
 * ```
 */
export interface MDXModule {
  /** Default export is the MDX content component */
  default: MDXContentComponent;
  /** Optional metadata export */
  metadata?: MDXMetadata;
}

