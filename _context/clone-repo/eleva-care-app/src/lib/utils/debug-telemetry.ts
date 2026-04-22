/**
 * Debug Telemetry Utility
 *
 * Provides a centralized, secure way to send debug telemetry data during development.
 * All telemetry is gated behind environment flags and sensitive data is automatically redacted.
 *
 * @example
 * ```typescript
 * import { sendDebugTelemetry, redactSensitiveData } from '@/lib/utils/debug-telemetry';
 *
 * // Simple usage - automatically redacts and gates
 * await sendDebugTelemetry({
 *   location: 'api/user/billing:auth',
 *   message: 'Auth result',
 *   data: { userId, hasId: !!userId },
 * });
 * ```
 */

/**
 * Generate a unique session ID for telemetry correlation.
 * Uses crypto.randomUUID if available, falls back to timestamp-based ID.
 */
const generateSessionId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/** Unique session ID for correlating telemetry events within a session */
const SESSION_ID = generateSessionId();

/** Timeout in milliseconds for telemetry fetch requests */
const TELEMETRY_TIMEOUT_MS = 5000;

/**
 * Environment flag to enable debug telemetry.
 * Set DEBUG_TELEMETRY=true or NODE_ENV=development to enable.
 */
const isDebugTelemetryEnabled = (): boolean => {
  return process.env.DEBUG_TELEMETRY === 'true' || process.env.NODE_ENV === 'development';
};

/**
 * Flag to ensure telemetry endpoint warning is logged only once per session.
 * Prevents log spam when getTelemetryEndpoint is called multiple times.
 */
let telemetryEndpointWarningLogged = false;

/**
 * Telemetry endpoint - MUST be configured via DEBUG_TELEMETRY_ENDPOINT env var.
 * Returns null if not configured, which will cause telemetry to be skipped.
 */
const getTelemetryEndpoint = (): string | null => {
  const endpoint = process.env.DEBUG_TELEMETRY_ENDPOINT;
  if (!endpoint) {
    // Only warn once per session in development
    if (process.env.NODE_ENV === 'development' && !telemetryEndpointWarningLogged) {
      console.debug(
        '[Telemetry] DEBUG_TELEMETRY_ENDPOINT not configured, telemetry disabled',
      );
      telemetryEndpointWarningLogged = true;
    }
    return null;
  }
  return endpoint;
};

/**
 * Patterns for sensitive field names that should be redacted.
 * Includes PII patterns for phone, address, SSN, credit card, etc.
 */
const SENSITIVE_PATTERNS = [
  /^user.?id$/i,
  /workos.?id$/i,
  /stripe.*(id|key|secret)/i,
  /customer.?id$/i,
  /email$/i,
  /token$/i,
  /password$/i,
  /secret$/i,
  /api.?key$/i,
  /session.?id$/i,
  /^(entity|record|document|object)?.?id$/i, // More specific than just /^id$/i
  // Additional PII patterns
  /phone/i,
  /address/i,
  /street/i,
  /city/i,
  /zip.?code/i,
  /postal.?code/i,
  /ssn/i,
  /social.?security/i,
  /credit.?card/i,
  /card.?number/i,
  /cvv/i,
  /expir(y|ation)/i,
  /ip.?address/i,
  /birth.?date/i,
  /dob$/i,
];

/**
 * Fields that should be converted to boolean presence indicators
 */
const PRESENCE_ONLY_FIELDS = [
  'userId',
  'workosUserId',
  'stripeCustomerId',
  'stripeConnectAccountId',
  'email',
  'guestEmail',
  'expertEmail',
  'token',
  'sessionId',
];

/**
 * Redacts sensitive data from a payload object.
 * Converts sensitive IDs to boolean presence indicators.
 *
 * @param data - The data object to redact
 * @returns A redacted copy of the data, or the original value if not an object
 */
export function redactSensitiveData(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    // FIRST: Remove stack traces (check before pattern-based redaction)
    if (key === 'errorStack' || key === 'stack') {
      redacted[key] = value ? '[STACK_REDACTED]' : null;
      continue;
    }

    // Check if this is a presence-only field
    if (PRESENCE_ONLY_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      redacted[`has${key.charAt(0).toUpperCase()}${key.slice(1)}`] = !!value;
      continue;
    }

    // Check if field matches sensitive patterns
    if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(key))) {
      redacted[key] = value ? '[REDACTED]' : null;
      continue;
    }

    // Recursively redact nested objects and arrays
    if (value && typeof value === 'object') {
      redacted[key] = redactSensitiveData(value);
      continue;
    }

    // Keep non-sensitive data as-is
    redacted[key] = value;
  }

  return redacted;
}

/**
 * Redacts a full response payload, keeping only safe diagnostic info.
 * Only reports boolean presence indicators, not field names (to prevent schema leakage).
 *
 * @param payload - The full response payload
 * @returns A safe diagnostic summary with presence indicators only
 *
 * @example
 * ```typescript
 * const response = { user: { id: '123', email: 'test@example.com' }, customer: { id: 'cus_123' } };
 * const safe = redactResponsePayload(response);
 * // Returns: { hasUser: true, hasCustomer: true, hasAccountStatus: false, ... }
 * ```
 */
export function redactResponsePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    hasUser: !!payload?.user,
    hasCustomer: !!payload?.customer,
    hasAccountStatus: !!payload?.accountStatus,
    hasDefaultPaymentMethod: !!(payload?.customer as Record<string, unknown>)?.defaultPaymentMethod,
    // Report counts instead of field names to avoid schema leakage
    userFieldCount: payload?.user ? Object.keys(payload.user as object).length : 0,
    customerFieldCount: payload?.customer ? Object.keys(payload.customer as object).length : 0,
  };
}

/**
 * Telemetry payload interface
 */
export interface DebugTelemetryPayload {
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
}

/**
 * Sends debug telemetry data to the configured endpoint.
 * Automatically gates behind environment flags and redacts sensitive data.
 *
 * @param payload - The telemetry payload to send
 * @returns Promise that resolves when telemetry is sent (or skipped)
 *
 * @example
 * ```typescript
 * await sendDebugTelemetry({
 *   location: 'api/user/billing:auth',
 *   message: 'Auth result',
 *   data: { userId: 'user_123', email: 'test@example.com' },
 * });
 * // Sends: { data: { hasUserId: true, email: '[REDACTED]' } }
 * ```
 */
export async function sendDebugTelemetry(payload: DebugTelemetryPayload): Promise<void> {
  // Gate behind environment flag
  if (!isDebugTelemetryEnabled()) {
    return;
  }

  const endpoint = getTelemetryEndpoint();
  if (!endpoint) {
    return; // No endpoint configured, skip telemetry
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEMETRY_TIMEOUT_MS);

  try {
    const redactedData = payload.data ? redactSensitiveData(payload.data) : {};

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: payload.location,
        message: payload.message,
        data: redactedData,
        timestamp: Date.now(),
        sessionId: SESSION_ID,
        hypothesisId: payload.hypothesisId,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    // Log errors in development for debugging
    if (process.env.NODE_ENV === 'development') {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.debug(`[Telemetry] Failed to send: ${errorMessage}`);
    }
    // Silently fail in production - telemetry should never break the app
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Synchronous version for use in non-async contexts.
 * Fire-and-forget pattern - does not block and silently handles errors.
 *
 * @param payload - The telemetry payload to send
 *
 * @example
 * ```typescript
 * // Use in event handlers or synchronous code paths
 * function handleClick() {
 *   sendDebugTelemetrySync({
 *     location: 'ui/button:click',
 *     message: 'User clicked submit',
 *     data: { formType: 'contact' },
 *   });
 *   // Continue with synchronous logic...
 * }
 * ```
 */
export function sendDebugTelemetrySync(payload: DebugTelemetryPayload): void {
  sendDebugTelemetry(payload).catch(() => {});
}
