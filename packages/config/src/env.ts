import { z } from 'zod';

/**
 * Eleva v3 environment variable validator.
 *
 * S0 seeds only the platform/multi-zone vars so the scaffolds can parse an
 * empty `.env` without crashing. Each subsequent sprint extends this schema
 * with the vars its packages need (auth in S1, stripe in S2, calendar in
 * S3, etc.).
 *
 * Usage:
 *   import { env } from '@eleva/config/env';
 *   const appUrl = env().APP_URL;
 *
 * Do not import `process.env` directly in app code — always go through this
 * validator so a missing or malformed var fails fast at boot.
 */

const urlOptional = z.string().url().optional().or(z.literal(''));

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: urlOptional,
  API_URL: urlOptional,
  DOCS_URL: urlOptional,
  APP_ASSET_PREFIX: urlOptional,
  API_ASSET_PREFIX: urlOptional,
  DOCS_ASSET_PREFIX: urlOptional,
});

export type BaseEnv = z.infer<typeof baseSchema>;

let cached: BaseEnv | null = null;

export function env(): BaseEnv {
  if (cached) return cached;
  const parsed = baseSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${lines}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
