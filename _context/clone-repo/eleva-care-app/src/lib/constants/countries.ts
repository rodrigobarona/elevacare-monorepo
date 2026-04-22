/**
 * Stripe Connect supported countries with human-readable labels.
 *
 * Source: https://stripe.com/global
 * Sorted alphabetically by label for UI display.
 */
export const STRIPE_CONNECT_COUNTRIES = [
  { code: 'AT', label: 'Austria' },
  { code: 'AU', label: 'Australia' },
  { code: 'BE', label: 'Belgium' },
  { code: 'BR', label: 'Brazil' },
  { code: 'CA', label: 'Canada' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'CY', label: 'Cyprus' },
  { code: 'CZ', label: 'Czech Republic' },
  { code: 'DE', label: 'Germany' },
  { code: 'DK', label: 'Denmark' },
  { code: 'EE', label: 'Estonia' },
  { code: 'ES', label: 'Spain' },
  { code: 'FI', label: 'Finland' },
  { code: 'FR', label: 'France' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'GR', label: 'Greece' },
  { code: 'HK', label: 'Hong Kong' },
  { code: 'IE', label: 'Ireland' },
  { code: 'IT', label: 'Italy' },
  { code: 'JP', label: 'Japan' },
  { code: 'LT', label: 'Lithuania' },
  { code: 'LU', label: 'Luxembourg' },
  { code: 'LV', label: 'Latvia' },
  { code: 'MX', label: 'Mexico' },
  { code: 'MY', label: 'Malaysia' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'NO', label: 'Norway' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'PL', label: 'Poland' },
  { code: 'PT', label: 'Portugal' },
  { code: 'SE', label: 'Sweden' },
  { code: 'SG', label: 'Singapore' },
  { code: 'SK', label: 'Slovakia' },
  { code: 'TH', label: 'Thailand' },
  { code: 'US', label: 'United States' },
] as const;

export type StripeConnectCountryCode = (typeof STRIPE_CONNECT_COUNTRIES)[number]['code'];

export const STRIPE_CONNECT_COUNTRY_CODES = STRIPE_CONNECT_COUNTRIES.map(
  (c) => c.code,
) as unknown as readonly StripeConnectCountryCode[];

const countryMap = new Map(STRIPE_CONNECT_COUNTRIES.map((c) => [c.code, c.label]));

export function getCountryLabel(code: string): string {
  return countryMap.get(code as StripeConnectCountryCode) ?? code;
}
