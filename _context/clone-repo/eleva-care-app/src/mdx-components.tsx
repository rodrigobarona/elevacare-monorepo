import type { MDXComponents } from 'mdx/types';
import Image from 'next/image';
import type { ImageProps } from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Headless MDX Components
 *
 * Custom MDX components for marketing pages (/legal/*, /trust/*).
 * Uses standard Tailwind classes - NO Fumadocs CSS dependency.
 *
 * For documentation pages (/docs/*), use @/app/docs/mdx-components instead.
 *
 * @see https://nextjs.org/docs/app/building-your-application/configuring/mdx
 */

// =============================================================================
// CUSTOM COMPONENTS
// =============================================================================

/**
 * Custom image component with Next.js optimization
 */
function ElevaImage(props: ImageProps & { src: string }) {
  const { src, alt = '', width, height, ...rest } = props;

  if (width && height) {
    return (
      <div className="my-6 overflow-hidden rounded-xl shadow-xl outline-1 -outline-offset-1 outline-black/10">
        <Image
          className="h-auto w-full object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          src={src}
          alt={alt}
          width={width}
          height={height}
          {...rest}
        />
      </div>
    );
  }

  return (
    <div className="relative my-6 aspect-video overflow-hidden rounded-xl shadow-xl outline-1 -outline-offset-1 outline-black/10">
      <Image
        className="object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        src={src}
        alt={alt}
        fill
        {...rest}
      />
    </div>
  );
}

/**
 * Smart link component with external link handling
 */
function ElevaLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
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
 * Callout component for highlighting important information
 */
function Callout({
  type = 'info',
  children,
}: {
  type?: 'info' | 'warning' | 'tip' | 'success';
  children: ReactNode;
}) {
  const styles = {
    info: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
    tip: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30',
    success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
  };

  const icons = { info: '💡', warning: '⚠️', tip: '💡', success: '✅' };

  return (
    <div className={`my-4 rounded-lg border p-4 ${styles[type]}`}>
      <div className="flex gap-3">
        <span className="text-lg">{icons[type]}</span>
        <div className="flex-1 text-sm [&>p]:mb-0">{children}</div>
      </div>
    </div>
  );
}

/**
 * Cards container for grid layouts
 */
function Cards({ children }: { children: ReactNode }) {
  return <div className="not-prose my-6 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

/**
 * Card component for navigation links
 */
function Card({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="hover:border-eleva-primary group block rounded-lg border border-gray-200 p-4 no-underline transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
    >
      <h3 className="group-hover:text-eleva-primary mb-2 font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{children}</p>
    </Link>
  );
}

// =============================================================================
// MDX COMPONENTS
// =============================================================================

/**
 * MDX components for headless/marketing pages
 *
 * Uses standard Tailwind classes (no fd-* CSS variables required).
 * Perfect for /legal/*, /trust/*, and other marketing content.
 */
export const mdxComponents: MDXComponents = {
  // Custom components
  Callout,
  Cards,
  Card,

  // Headings with Eleva branding
  h1: ({ children }) => (
    <h1 className="text-eleva-primary mt-8 mb-6 font-serif text-4xl/[0.9] font-light tracking-tight text-balance md:text-5xl/[0.9]">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-eleva-primary mt-8 mb-4 font-serif text-2xl font-light tracking-tight text-balance md:text-3xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-eleva-neutral-900 mt-6 mb-3 font-sans text-xl font-medium tracking-tight text-balance dark:text-gray-100">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-eleva-neutral-900/80 mt-4 mb-2 font-sans text-lg font-medium dark:text-gray-200">
      {children}
    </h4>
  ),

  // Text elements
  p: ({ children }) => (
    <p className="text-eleva-neutral-900 mb-4 leading-7 font-light dark:text-gray-300">
      {children}
    </p>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-eleva-primary/30 text-eleva-neutral-900/80 my-6 border-l-4 pl-4 italic dark:text-gray-400">
      {children}
    </blockquote>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="text-eleva-neutral-900 mb-6 list-disc space-y-2 pl-6 dark:text-gray-300">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="text-eleva-neutral-900 mb-6 list-decimal space-y-2 pl-6 dark:text-gray-300">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="mb-1 font-light">{children}</li>,

  // Code elements
  code: ({ children }) => (
    <code className="text-eleva-neutral-900 rounded bg-gray-100 px-1 py-0.5 font-mono text-sm dark:bg-gray-800 dark:text-gray-200">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="text-eleva-neutral-900 my-6 overflow-auto rounded-md bg-gray-100 p-4 font-mono text-sm dark:bg-gray-800 dark:text-gray-200">
      {children}
    </pre>
  ),

  // Table elements
  table: ({ children }) => (
    <div className="my-6 w-full overflow-x-auto">
      <table className="text-eleva-neutral-900 w-full border-collapse text-sm dark:text-gray-300">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="sticky top-0 z-10 border-b bg-gray-50 dark:bg-gray-800">{children}</thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y">{children}</tbody>,
  tr: ({ children }) => (
    <tr className="m-0 border-t p-0 even:bg-gray-50 dark:even:bg-gray-800/50">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="text-eleva-neutral-900/70 border px-4 py-2 text-left font-mono text-xs font-semibold tracking-widest uppercase dark:text-gray-400">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="text-eleva-neutral-900 border px-4 py-2 text-left font-light dark:text-gray-300">
      {children}
    </td>
  ),

  // Shared components
  img: ElevaImage as MDXComponents['img'],
  a: ElevaLink,
};

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Get MDX components with optional overrides
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...mdxComponents,
    ...components,
  };
}

/**
 * MDX component hook for Next.js MDX integration
 *
 * Note: Named "useMDXComponents" to follow MDX/Next.js conventions,
 * though it's not a React Hook (no hook rules apply).
 * This naming is expected by @next/mdx and maintains API compatibility.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return getMDXComponents(components);
}
