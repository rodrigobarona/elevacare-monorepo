import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import Link from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';
import type { ReactNode } from 'react';

/**
 * Fumadocs MDX Components
 *
 * Custom MDX components for Help Center pages (/help/*).
 * Extends Fumadocs defaults with all built-in components for rich documentation.
 *
 * Built-in components included:
 * - Accordion/Accordions - Collapsible FAQ sections
 * - Steps/Step - Sequential guides
 * - Tabs/Tab - Tabbed content
 * - Files/Folder/File - File tree displays
 * - TypeTable - API type documentation
 * - ImageZoom - Zoomable images
 * - Callout - Info/warning/error boxes (via defaultMdxComponents)
 * - Cards/Card - Navigation cards
 *
 * REQUIRES: docs.css loaded (provides fd-* CSS variables)
 *
 * @see https://fumadocs.vercel.app/docs/ui/mdx
 * @see https://fumadocs.vercel.app/docs/ui/components
 */

// =============================================================================
// CUSTOM COMPONENTS
// =============================================================================

/**
 * Smart link component with external link handling
 */
function DocsLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const actualHref = href || '#';

  // External links
  if (actualHref.startsWith('http://') || actualHref.startsWith('https://')) {
    return (
      <a href={actualHref} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }

  // Special protocol links (mailto, tel, hash)
  if (
    actualHref.startsWith('mailto:') ||
    actualHref.startsWith('tel:') ||
    actualHref.startsWith('#')
  ) {
    return (
      <a href={actualHref} {...props}>
        {children}
      </a>
    );
  }

  // Internal links use Next.js Link
  return (
    <Link href={actualHref} {...props}>
      {children}
    </Link>
  );
}

/**
 * Cards container with Eleva branding
 * Uses fd-* classes that require Fumadocs CSS
 */
function DocsCards({ children }: { children: ReactNode }) {
  return <div className="not-prose my-6 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

/**
 * Card component with Eleva branding
 * Uses fd-* classes that require Fumadocs CSS
 */
function DocsCard({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="border-fd-border hover:border-eleva-primary hover:bg-fd-accent/50 group block rounded-lg border p-4 no-underline transition-colors"
    >
      <h3 className="text-fd-foreground group-hover:text-eleva-primary mb-2 font-semibold">
        {title}
      </h3>
      {/* Use div instead of p to avoid nesting issues when MDX content contains <p> tags */}
      <div className="text-fd-muted-foreground text-sm">{children}</div>
    </Link>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * MDX components for Fumadocs documentation pages
 *
 * Includes all Fumadocs built-in components:
 * - Heading IDs for ToC navigation
 * - Callout, Accordion, Steps, Tabs, Files
 * - Code syntax highlighting with Shiki
 *
 * Custom overrides with Eleva branding:
 * - Cards/Card: Navigation grid cards
 * - img: Zoomable images with Next.js optimization
 * - a: External link handling
 */
export const docsMdxComponents: MDXComponents = {
  // Spread Fumadocs defaults FIRST (includes headings with IDs, Callout, etc.)
  ...defaultMdxComponents,

  // Fumadocs built-in components for rich documentation
  Accordion,
  Accordions,
  Step,
  Steps,
  Tab,
  Tabs,
  File,
  Files,
  Folder,
  TypeTable,

  // Override specific components with Eleva branding
  Cards: DocsCards,
  Card: DocsCard,
  img: (props) => <ImageZoom {...(props as ComponentPropsWithoutRef<typeof ImageZoom>)} />,
  a: DocsLink,
};

/**
 * Get docs MDX components with optional overrides
 *
 * @param components - Optional MDX components to override defaults
 * @returns MDX components for Help Center pages
 *
 * @example
 * ```tsx
 * const components = getDocsMDXComponents({
 *   CustomAlert: MyCustomAlert,
 * });
 *
 * <MDXContent components={components} />
 * ```
 */
export function getDocsMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...docsMdxComponents,
    ...components,
  };
}
