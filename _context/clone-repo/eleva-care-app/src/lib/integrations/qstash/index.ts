/**
 * QStash Integration Module
 *
 * Provides a unified interface for QStash queue operations and scheduling.
 * Signature verification is handled by `verifySignatureAppRouter` from `@upstash/qstash/nextjs`.
 *
 * @example
 * ```typescript
 * import { qstashClient } from '@/lib/integrations/qstash';
 *
 * await qstashClient.publishJSON({
 *   url: 'https://example.com/api/webhook',
 *   body: { data: 'value' }
 * });
 * ```
 */

export { qstashClient } from './client';
export { isQStashAvailable, qstashHealthCheck } from './config';
export { setupQStashSchedules } from './schedules';
