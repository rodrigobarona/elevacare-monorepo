// Mock for next-intl/server - Vitest compatible
import { vi } from 'vitest';

export const getTranslations = vi.fn(() => (key: string) => key);
export const getLocale = vi.fn(() => 'en');
export const getMessages = vi.fn(() => ({}));
export const getNow = vi.fn(() => new Date());
export const getRequestConfig = vi.fn(() => ({}));
export const getTimeZone = vi.fn(() => 'UTC');
export const setRequestLocale = vi.fn();

// Default export for compatibility
const mockNextIntlServer = {
  getTranslations,
  getLocale,
  getMessages,
  getNow,
  getRequestConfig,
  getTimeZone,
  setRequestLocale,
};

export default mockNextIntlServer;
