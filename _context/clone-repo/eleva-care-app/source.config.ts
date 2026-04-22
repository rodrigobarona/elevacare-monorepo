import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

/**
 * Fumadocs MDX Global Configuration
 *
 * The default preset automatically includes these plugins:
 *
 * Remark Plugins (included by default):
 * - remarkImage: Adds width/height to images for Next.js optimization
 * - remarkHeading: Applies IDs to headings, extracts Table of Contents
 * - remarkStructure: Generates search indexes
 * - remarkGfm: GitHub Flavored Markdown (tables, strikethrough, autolinks)
 *
 * Rehype Plugins (included by default):
 * - rehypeCode: Syntax highlighting with Shiki
 * - rehypeToc: Exports TOC as JSX-compatible data
 *
 * @see https://fumadocs.vercel.app/docs/mdx/mdx
 */
export default defineConfig({
  mdxOptions: {
    // Custom plugins can be added here (defaults are preserved)
    // remarkPlugins: [myPlugin],
    // rehypePlugins: [myPlugin],

    // Customize built-in plugin options:
    // remarkImageOptions: { placeholder: 'blur' },
    // remarkHeadingOptions: { generateToc: true },
    // rehypeCodeOptions: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
});

/**
 * Fumadocs Content Collections Configuration
 *
 * This file defines all content collections for the Eleva Care platform:
 * - Help Center portals (Patient, Expert, Workspace) - Use Fumadocs UI
 * - Marketing pages - Use Fumadocs Core (headless) with Eleva components
 * - Legal documents - Use Fumadocs Core (headless)
 * - Trust center - Use Fumadocs Core (headless)
 */

// =============================================================================
// DOCUMENTATION COLLECTIONS (Fumadocs UI)
// =============================================================================

/**
 * Patient Help Center
 * Help articles for end users who book appointments
 */
export const patient = defineDocs({
  dir: 'src/content/help/patient',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true, // Enable for AI/LLM access
    },
  },
});

/**
 * Expert Resources
 * Help articles for healthcare professionals (Community and Top Experts)
 */
export const expert = defineDocs({
  dir: 'src/content/help/expert',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true, // Enable for AI/LLM access
    },
  },
});

/**
 * Workspace Portal
 * Help articles for workspace management (clinics, wellness centers, employers)
 * Internal terminology: "Workspace" (e.g., "Dr. Patricia's workspace")
 * Marketing terminology: "For Organizations" (external sales/SEO)
 */
export const workspace = defineDocs({
  dir: 'src/content/help/workspace',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true, // Enable for AI/LLM access
    },
  },
});


// =============================================================================
// NOTE: MARKETING, LEGAL & TRUST USE NATIVE MDX IMPORTS
// =============================================================================
// These content types use native Next.js MDX imports instead of Fumadocs:
// - Marketing: Heavy custom component usage (TeamSection, BeliefsSection, etc.)
// - Legal: Simple MDX with standard prose styling
// - Trust: Simple MDX with standard prose styling
//
// See: src/app/(marketing)/[locale]/about/page.tsx for the pattern
// See: src/app/(marketing)/[locale]/legal/[document]/page.tsx for legal
// See: src/app/(marketing)/[locale]/trust/[document]/page.tsx for trust
