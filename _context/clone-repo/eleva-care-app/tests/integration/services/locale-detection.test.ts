import { vi, describe, it, expect, test } from 'vitest';
import { detectLocaleFromHeaders } from '@/lib/i18n/utils';

/**
 * Locale Detection Integration Tests
 *
 * Tests the detectLocaleFromHeaders function which:
 * 1. First tries Accept-Language header (priority)
 * 2. Falls back to x-vercel-ip-country geolocation
 * 3. Returns null if no match found
 */

class MockHeaders {
  private headers: Map<string, string[]>;

  constructor(headers: Record<string, string | undefined>) {
    this.headers = new Map(
      Object.entries(headers)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k.toLowerCase(), [v as string]]),
    );
  }

  get(name: string): string | null {
    const values = this.headers.get(name.toLowerCase());
    return values && values.length > 0 ? values[0] : null;
  }

  has(name: string): boolean {
    return this.headers.has(name.toLowerCase());
  }

  forEach(callbackfn: (value: string, key: string, parent: Headers) => void): void {
    this.headers.forEach((values, key) => {
      callbackfn(values.join(', '), key, this as unknown as Headers);
    });
  }

  append(name: string, value: string): void {
    const normalizedName = name.toLowerCase();
    const existing = this.headers.get(normalizedName);
    if (existing) {
      existing.push(value);
    } else {
      this.headers.set(normalizedName, [value]);
    }
  }

  delete(name: string): void {
    this.headers.delete(name.toLowerCase());
  }

  set(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), [value]);
  }

  entries(): IterableIterator<[string, string]> {
    const entriesArray: [string, string][] = [];
    this.headers.forEach((values, key) => {
      entriesArray.push([key, values.join(', ')]);
    });
    return entriesArray[Symbol.iterator]();
  }

  keys(): IterableIterator<string> {
    return this.headers.keys();
  }

  values(): IterableIterator<string> {
    const valuesArray: string[] = [];
    this.headers.forEach((values) => {
      valuesArray.push(values.join(', '));
    });
    return valuesArray[Symbol.iterator]();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  getSetCookie(): string[] {
    return [];
  }
}

describe('Locale Detection Integration Tests', () => {
  // Suppress console.log during tests
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Accept-Language tests
   * The function FIRST checks Accept-Language, so these should match
   */
  const acceptLanguageTestCases = [
    {
      name: 'Portuguese visitor from Portugal (Accept-Language pt-PT)',
      headers: {
        'x-vercel-ip-country': 'PT',
        'accept-language': 'pt-PT,pt;q=0.9,en;q=0.8',
      },
      expected: 'pt', // pt-PT maps to 'pt'
    },
    {
      name: 'Brazilian visitor (Accept-Language pt-BR)',
      headers: {
        'x-vercel-ip-country': 'BR',
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      expected: 'pt-BR',
    },
    {
      name: 'Portuguese language preference without country header',
      headers: {
        'accept-language': 'pt,en;q=0.9',
      },
      expected: 'pt',
    },
    {
      name: 'Explicit pt-PT language preference',
      headers: {
        'accept-language': 'pt-PT,pt;q=0.9,en;q=0.8',
      },
      expected: 'pt',
    },
    {
      name: 'Explicit pt-BR language preference',
      headers: {
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      expected: 'pt-BR',
    },
    {
      name: 'US visitor with English',
      headers: {
        'x-vercel-ip-country': 'US',
        'accept-language': 'en-US,en;q=0.9',
      },
      // Accept-Language matches 'en' which is a supported locale
      expected: 'en',
    },
    {
      name: 'Spanish visitor',
      headers: {
        'x-vercel-ip-country': 'ES',
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      expected: 'es',
    },
  ];

  test.each(acceptLanguageTestCases)('$name', ({ headers, expected }) => {
    const mockHeaders = new MockHeaders(headers);
    const result = detectLocaleFromHeaders(mockHeaders as unknown as Headers);
    expect(result).toBe(expected);
  });

  describe('Geolocation Fallback', () => {
    // These tests verify that when Accept-Language doesn't match,
    // the function falls back to country geolocation

    it('should fall back to country header when Accept-Language has no match', () => {
      const mockHeaders = new MockHeaders({
        'x-vercel-ip-country': 'PT',
        // Japanese is not supported, so fallback to country
        'accept-language': 'ja-JP,ja;q=0.9',
      });
      const result = detectLocaleFromHeaders(mockHeaders as unknown as Headers);
      expect(result).toBe('pt');
    });

    it('should fall back to Brazil locale when from BR with unsupported language', () => {
      const mockHeaders = new MockHeaders({
        'x-vercel-ip-country': 'BR',
        // Korean is not supported, so fallback to country
        'accept-language': 'ko-KR,ko;q=0.9',
      });
      const result = detectLocaleFromHeaders(mockHeaders as unknown as Headers);
      expect(result).toBe('pt-BR');
    });

    it('should use country header when accept-language is missing', () => {
      const mockHeaders = new MockHeaders({
        'x-vercel-ip-country': 'PT',
      });
      const result = detectLocaleFromHeaders(mockHeaders as unknown as Headers);
      expect(result).toBe('pt');
    });
    });

  describe('Edge Cases', () => {
    it('should handle invalid accept-language format', () => {
      const mockHeaders = new MockHeaders({
        'accept-language': 'invalid-format',
      });
      const result = detectLocaleFromHeaders(mockHeaders as unknown as Headers);
      expect(result).toBeNull();
    });

    it('should handle empty headers', () => {
      const mockHeaders = new MockHeaders({});
      const result = detectLocaleFromHeaders(mockHeaders as unknown as Headers);
      expect(result).toBeNull();
    });

    it('should return null for unsupported country without accept-language', () => {
      const mockHeaders = new MockHeaders({
        'x-vercel-ip-country': 'JP', // Japan is not in the country mapping
      });
      const result = detectLocaleFromHeaders(mockHeaders as unknown as Headers);
      expect(result).toBeNull();
    });
  });

  describe('Priority Order', () => {
    // The function prioritizes Accept-Language over country geolocation
    // This is by design: user's explicit preference > automatic detection

    it('should prefer Accept-Language over country header (user choice matters)', () => {
      // User in Portugal explicitly prefers English
      const mockHeaders = new MockHeaders({
        'x-vercel-ip-country': 'PT',
        'accept-language': 'en-US,en;q=0.9',
      });
      const result = detectLocaleFromHeaders(mockHeaders as unknown as Headers);
      // Accept-Language wins - respects user's explicit preference
      expect(result).toBe('en');
    });

    it('should prefer Accept-Language over country for Brazilian users preferring English', () => {
      // User in Brazil explicitly prefers English
      const mockHeaders = new MockHeaders({
        'x-vercel-ip-country': 'BR',
        'accept-language': 'en-US,en;q=0.9',
      });
      const result = detectLocaleFromHeaders(mockHeaders as unknown as Headers);
      // Accept-Language wins - respects user's explicit preference
      expect(result).toBe('en');
    });
  });
});
