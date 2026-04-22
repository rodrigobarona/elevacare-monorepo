/**
 * Server-side utility functions for extracting request metadata
 *
 * These utilities are used for audit logging, security monitoring,
 * and compliance requirements (GDPR, LGPD, SOC 2).
 */
import { headers } from 'next/headers';

/**
 * Extract client IP address from request headers
 *
 * Checks multiple headers in order of preference:
 * 1. x-real-ip (most direct from proxy)
 * 2. x-forwarded-for (standard proxy header, takes first IP)
 * 3. x-vercel-forwarded-for (Vercel-specific header)
 *
 * Returns 'unknown' if no IP address can be determined.
 * This is acceptable for optional fraud prevention logging.
 *
 * @returns Client IP address or 'unknown'
 */
export async function getClientIpAddress(): Promise<string> {
  const headersList = await headers();

  // Try x-real-ip first (most direct)
  const realIp = headersList.get('x-real-ip');
  if (realIp) return realIp;

  // Try x-forwarded-for (may contain multiple IPs, take first)
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  // Try Vercel-specific header
  const vercelForwardedFor = headersList.get('x-vercel-forwarded-for');
  if (vercelForwardedFor) {
    const firstIp = vercelForwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  // Return unknown if no IP can be determined
  return 'unknown';
}

/**
 * Extract user agent from request headers
 *
 * Used for audit logging and security monitoring.
 *
 * @returns User agent string or 'unknown'
 */
export async function getUserAgent(): Promise<string> {
  const headersList = await headers();
  return headersList.get('user-agent') || 'unknown';
}

/**
 * Extract both IP and user agent for audit logging
 *
 * Convenience function to get both values at once.
 *
 * @returns Object containing ipAddress and userAgent
 */
export async function getRequestMetadata(): Promise<{
  ipAddress: string;
  userAgent: string;
}> {
  const [ipAddress, userAgent] = await Promise.all([getClientIpAddress(), getUserAgent()]);
  return { ipAddress, userAgent };
}
