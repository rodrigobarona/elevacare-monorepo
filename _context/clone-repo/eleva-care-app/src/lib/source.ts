import { loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { expert, patient, workspace } from 'fumadocs-mdx:collections/server';

import { i18n } from './fumadocs-i18n.config';

/**
 * Fumadocs Source Loaders
 *
 * Each portal has its own source loader for proper URL handling.
 * Uses the recommended .toFumadocsSource() method on defineDocs collections.
 * Uses lucideIconsPlugin to render Lucide icons in sidebar.
 *
 * URL Structure (following next-intl as-needed pattern):
 * - /help/patient - English patient help (default, no locale prefix)
 * - /pt/help/patient - Portuguese patient help
 *
 * Locale is determined from URL params via the [locale] route segment.
 * The proxy middleware runs i18n routing for marketing routes including /help.
 *
 * @see https://fumadocs.vercel.app/docs/headless/source-api
 * @see https://fumadocs.vercel.app/docs/mdx
 */

export const patientSource = loader({
  baseUrl: '/help/patient',
  source: patient.toFumadocsSource(),
  i18n,
  plugins: [lucideIconsPlugin()],
});

export const expertSource = loader({
  baseUrl: '/help/expert',
  source: expert.toFumadocsSource(),
  i18n,
  plugins: [lucideIconsPlugin()],
});

export const workspaceSource = loader({
  baseUrl: '/help/workspace',
  source: workspace.toFumadocsSource(),
  i18n,
  plugins: [lucideIconsPlugin()],
});

/**
 * Portal sources map - used by dynamic [portal] route
 */
export const portalSources = {
  patient: patientSource,
  expert: expertSource,
  workspace: workspaceSource,
} as const;

export type PortalKey = keyof typeof portalSources;

/**
 * Get source for a portal
 */
export function getPortalSource(portal: string) {
  return portalSources[portal as PortalKey];
}

/**
 * Check if portal is valid
 */
export function isValidPortal(portal: string): portal is PortalKey {
  return portal in portalSources;
}
