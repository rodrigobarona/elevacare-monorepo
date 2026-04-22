import { withSentryConfig } from '@sentry/nextjs';
import { withBotId } from 'botid/next/config';
import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withNextVideo } from 'next-video/process';

/**
 * Bundle analyzer configuration
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/**
 * MDX configuration using Fumadocs MDX
 *
 * Fumadocs MDX provides:
 * - Build-time MDX compilation with content collections
 * - Virtual module imports (fumadocs-mdx:collections/server)
 * - Type-safe frontmatter with Zod schemas
 * - Automatic TOC generation
 *
 * @see https://fumadocs.vercel.app/docs/mdx
 */
const withMDX = createMDX({
  // MDX options are now configured in source.config.ts
  // configPath: 'source.config.ts' // default path
});

/**
 * Internationalization plugin
 * Enables i18n features through next-intl
 */
const withNextIntl = createNextIntlPlugin({
  requestConfig: './src/lib/i18n/request.ts',
  experimental: {
    messages: {
      path: './src/messages',
      locales: 'infer',
      format: 'json',
      precompile: true,
    },
  },
});

const config: NextConfig = {
  // Environment variables to be injected at build time
  env: {
    BUILD_DATE: new Date().toISOString(),
  },

  // cacheComponents disabled -- next-intl 4.8.3 still requires next/root-params
  // which hasn't shipped yet. Track: https://github.com/amannn/next-intl/issues/1493
  // Using unstable_cache + tags as the bridge pattern (see server-actions.mdc)
  // cacheComponents: true,

  // Enable React Compiler for automatic memoization
  reactCompiler: true,

  /**
   * AI/LLM Help Center Access
   *
   * Rewrite rules to allow AI agents to access help content as markdown.
   * When a URL ends with .mdx, it's rewritten to the llms.mdx route handler.
   *
   * Examples:
   * - /help/patient/booking.mdx → /llms.mdx/help/patient/booking
   * - /help/expert/profile.mdx → /llms.mdx/help/expert/profile
   *
   * This enables AI agents to:
   * - Read help pages as plain markdown
   * - Index content for AI-powered search
   * - Provide better answers using our help content
   *
   * @see https://fumadocs.vercel.app/docs/integrations/llms
   */
  async rewrites() {
    return [
      {
        source: '/help/:portal/:path*.mdx',
        destination: '/llms.mdx/help/:portal/:path*',
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.clerk.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'image.mux.com',
      },
    ],
    // Optimize image quality settings for performance
    // 75: Default quality for most images
    // 90: High quality for hero/featured images
    qualities: [75, 90],
    // Prefer modern image formats for better compression
    formats: ['image/avif', 'image/webp'],
  },

  // External packages that should not be bundled by webpack
  serverExternalPackages: ['googleapis'],

  // Turbopack configuration (moved from experimental in Next.js 16)
  turbopack: {
    resolveExtensions: ['.js', '.jsx', '.ts', '.tsx', '.md', '.mdx', '.json'],
    resolveAlias: {
      // Add any alias mappings if needed
    },
  },

  experimental: {
    // Client-side router cache control for dynamic routes
    // Setting dynamic to 0 ensures dynamic content is always fresh (no stale cache)
    // Still experimental in Next.js 16, useful for maintaining data freshness
    staleTimes: {
      dynamic: 0,
    },

    // Reduces build-time memory usage by optimizing webpack memory allocation
    // Helps prevent OOM errors during builds with large codebases
    webpackMemoryOptimizations: true,

    // Enable webpack build worker to reduce memory usage
    webpackBuildWorker: true,

    // NOTE: optimizePackageImports removed - not needed with Turbopack (Next.js 16)
    // Turbopack automatically handles package optimization without explicit configuration
    // Reference: https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack
  },

  // Configure `pageExtensions` to include markdown and MDX files
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],

  // Enable automatic bundling for better performance
  bundlePagesRouterDependencies: true,
};

// Apply plugins in order: Bundle Analyzer -> MDX -> Next-Intl -> BotID -> Sentry
const nextConfig = withMDX(config);
const configWithPlugins = withBotId(withBundleAnalyzer(withNextIntl(nextConfig)));

/**
 * Sentry Configuration
 *
 * Wraps the Next.js config with Sentry for comprehensive error monitoring,
 * performance tracing, and source map uploads.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */
export default withNextVideo(
  withSentryConfig(configWithPlugins, {
    // Sentry organization and project slugs
    org: 'elevacare',
    project: 'eleva-care',

    // Auth token for source map uploads (set in environment variables)
    authToken: process.env.SENTRY_AUTH_TOKEN,

    // Only print logs for uploading source maps in CI
    // Set to `true` to suppress logs
    silent: !process.env.CI,

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware,
    // otherwise reporting of client-side errors will fail.
    tunnelRoute: '/monitoring',

    // Source map upload configuration
    sourcemaps: {
      // Ignore Next.js internal manifest files that don't have source maps
      // These are auto-generated RSC metadata files, not application code
      ignore: [
        'node_modules/**',
        '**/client-reference-manifest.js',
        '**/*_client-reference-manifest.js',
      ],
    },

    // Webpack-specific Sentry configuration (moved from root level in SDK v10+)
    webpack: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      // (Replaces deprecated `disableLogger` option)
      treeshake: {
        removeDebugLogging: true,
      },

      // Capture React component names for better debugging in Session Replay
      // (Replaces deprecated `reactComponentAnnotation` option)
      reactComponentAnnotation: {
        enabled: true,
      },

      // Automatically create Cron Monitors in Sentry for Vercel cron jobs
      // Note: Currently only supports Pages Router
      // (Replaces deprecated `automaticVercelMonitors` option)
      automaticVercelMonitors: true,
    },
  }),
);
