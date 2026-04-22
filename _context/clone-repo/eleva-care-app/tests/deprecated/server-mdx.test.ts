import { vi } from 'vitest';
import {
  getAvailableLocalesForNamespace,
  getMDXFileContent,
  mdxFileExists,
} from '@/lib/mdx/server-mdx';
import fs from 'fs/promises';

// Create spies on fs/promises methods with precise types
const mockReadFile = vi.spyOn(fs, 'readFile') as vi.SpyInstance;
const mockAccess = vi.spyOn(fs, 'access') as vi.SpyInstance;
const mockReaddir = vi.spyOn(fs, 'readdir') as vi.SpyInstance;

describe('MDX Server - Path Traversal Protection', () => {
  const mockFileContent = '# Test Content\n\nThis is a test.';

  beforeEach(() => {
    // Reset mocks completely (clears calls and implementations)
    mockReadFile.mockReset();
    mockAccess.mockReset();
    mockReaddir.mockReset();
  });

  describe('getMDXFileContent', () => {
    describe('valid inputs', () => {
      it('should accept valid namespace and locale', async () => {
        mockReadFile.mockResolvedValue(mockFileContent);

        const result = await getMDXFileContent({
          namespace: 'terms',
          locale: 'en',
        });

        expect(result.exists).toBe(true);
        expect(result.content).toBe(mockFileContent);
        expect(mockReadFile).toHaveBeenCalled();
      });

      it('should accept namespace with hyphens', async () => {
        mockReadFile.mockResolvedValue(mockFileContent);

        const result = await getMDXFileContent({
          namespace: 'expert-agreement',
          locale: 'en',
        });

        expect(result.exists).toBe(true);
        expect(result.content).toBe(mockFileContent);
      });

      it('should accept namespace with underscores', async () => {
        mockReadFile.mockResolvedValue(mockFileContent);

        const result = await getMDXFileContent({
          namespace: 'payment_policies',
          locale: 'en',
        });

        expect(result.exists).toBe(true);
        expect(result.content).toBe(mockFileContent);
      });

      it('should accept locale with hyphens', async () => {
        mockReadFile.mockResolvedValue(mockFileContent);

        const result = await getMDXFileContent({
          namespace: 'terms',
          locale: 'en-US',
        });

        expect(result.exists).toBe(true);
        expect(result.content).toBe(mockFileContent);
      });
    });

    describe('path traversal attempts', () => {
      it('should reject namespace with ../ pattern', async () => {
        const result = await getMDXFileContent({
          namespace: '../../../etc/passwd',
          locale: 'en',
        });

        expect(result.exists).toBe(false);
      });

      it('should reject namespace with ./ pattern', async () => {
        const result = await getMDXFileContent({
          namespace: './secret',
          locale: 'en',
        });

        expect(result.exists).toBe(false);
      });

      it('should reject locale with ../ pattern', async () => {
        const result = await getMDXFileContent({
          namespace: 'terms',
          locale: '../../secret',
        });

        expect(result.exists).toBe(false);
      });

      it('should reject namespace with forward slash', async () => {
        const result = await getMDXFileContent({
          namespace: 'terms/../../etc',
          locale: 'en',
        });

        expect(result.exists).toBe(false);
      });

      it('should reject namespace with backslash', async () => {
        const result = await getMDXFileContent({
          namespace: 'terms\\..\\secret',
          locale: 'en',
        });

        expect(result.exists).toBe(false);
      });

      it('should reject fallbackLocale with traversal patterns', async () => {
        const result = await getMDXFileContent({
          namespace: 'terms',
          locale: 'en',
          fallbackLocale: '../secret',
        });

        expect(result.exists).toBe(false);
      });
    });

    describe('invalid inputs', () => {
      it('should reject empty namespace', async () => {
        const result = await getMDXFileContent({
          namespace: '',
          locale: 'en',
        });

        expect(result.exists).toBe(false);
        expect(mockReadFile).not.toHaveBeenCalled();
      });

      it('should reject empty locale', async () => {
        const result = await getMDXFileContent({
          namespace: 'terms',
          locale: '',
        });

        expect(result.exists).toBe(false);
        expect(mockReadFile).not.toHaveBeenCalled();
      });

      it('should reject namespace with special characters', async () => {
        const result = await getMDXFileContent({
          namespace: 'terms@special',
          locale: 'en',
        });

        expect(result.exists).toBe(false);
        expect(mockReadFile).not.toHaveBeenCalled();
      });

      it('should reject locale with special characters', async () => {
        const result = await getMDXFileContent({
          namespace: 'terms',
          locale: 'en$US',
        });

        expect(result.exists).toBe(false);
        expect(mockReadFile).not.toHaveBeenCalled();
      });
    });

    describe('fallback behavior', () => {
      it('should use fallback locale when primary fails', async () => {
        mockReadFile
          .mockRejectedValueOnce(new Error('File not found'))
          .mockResolvedValueOnce(mockFileContent);

        const result = await getMDXFileContent({
          namespace: 'terms',
          locale: 'fr',
          fallbackLocale: 'en',
        });

        expect(result.exists).toBe(true);
        expect(result.usedFallback).toBe(true);
        expect(result.content).toBe(mockFileContent);
      });

      it('should return exists:false when both primary and fallback fail', async () => {
        mockReadFile.mockRejectedValue(new Error('File not found'));

        const result = await getMDXFileContent({
          namespace: 'terms',
          locale: 'fr',
          fallbackLocale: 'en',
        });

        expect(result.exists).toBe(false);
        expect(result.content).toBe('');
      });

      it('should normalize hyphenated fallbackLocale (en-US → us)', async () => {
        mockReadFile
          .mockRejectedValueOnce(new Error('File not found')) // primary locale fails
          .mockResolvedValueOnce(mockFileContent); // fallback succeeds

        const result = await getMDXFileContent({
          namespace: 'terms',
          locale: 'fr',
          fallbackLocale: 'en-US',
        });

        expect(result.exists).toBe(true);
        expect(result.usedFallback).toBe(true);
        expect(result.content).toBe(mockFileContent);
        // Verify the fallback locale was normalized via getFileLocale
        expect(result.locale).toBe('us'); // en-US → us per getFileLocale normalization
      });
    });
  });

  describe('mdxFileExists', () => {
    describe('valid inputs', () => {
      it('should return true for existing file', async () => {
        mockAccess.mockResolvedValue(undefined);

        const result = await mdxFileExists('terms', 'en');

        expect(result).toBe(true);
        expect(mockAccess).toHaveBeenCalled();
      });

      it('should return false for non-existing file', async () => {
        mockAccess.mockRejectedValue(new Error('File not found'));

        const result = await mdxFileExists('terms', 'fr');

        expect(result).toBe(false);
      });
    });

    describe('path traversal attempts', () => {
      it('should reject namespace with ../ pattern', async () => {
        const result = await mdxFileExists('../../../etc/passwd', 'en');

        expect(result).toBe(false);
      });

      it('should reject locale with ../ pattern', async () => {
        const result = await mdxFileExists('terms', '../../secret');

        expect(result).toBe(false);
      });

      it('should reject namespace with forward slash', async () => {
        const result = await mdxFileExists('terms/../secret', 'en');

        expect(result).toBe(false);
      });

      it('should reject namespace with backslash', async () => {
        const result = await mdxFileExists('terms\\..\\secret', 'en');

        expect(result).toBe(false);
      });
    });

    describe('invalid inputs', () => {
      it('should reject empty namespace', async () => {
        const result = await mdxFileExists('', 'en');

        expect(result).toBe(false);
      });

      it('should reject empty locale', async () => {
        const result = await mdxFileExists('terms', '');

        expect(result).toBe(false);
      });
    });
  });

  describe('getAvailableLocalesForNamespace', () => {
    describe('valid inputs', () => {
      it('should return available locales', async () => {
        mockReaddir.mockResolvedValue(['en.mdx', 'es.mdx', 'pt.mdx', 'README.md'] as any);

        const result = await getAvailableLocalesForNamespace('terms');

        expect(result).toEqual(['en', 'es', 'pt']);
        expect(mockReaddir).toHaveBeenCalled();
      });

      it('should handle empty directory', async () => {
        mockReaddir.mockResolvedValue([] as any);

        const result = await getAvailableLocalesForNamespace('empty-namespace');

        expect(result).toEqual([]);
      });
    });

    describe('path traversal attempts', () => {
      it('should reject namespace with ../ pattern', async () => {
        const result = await getAvailableLocalesForNamespace('../../../etc');

        expect(result).toEqual([]);
      });

      it('should reject namespace with forward slash', async () => {
        const result = await getAvailableLocalesForNamespace('terms/../secret');

        expect(result).toEqual([]);
      });

      it('should reject namespace with backslash', async () => {
        const result = await getAvailableLocalesForNamespace('terms\\..\\secret');

        expect(result).toEqual([]);
      });
    });

    describe('invalid inputs', () => {
      it('should reject empty namespace', async () => {
        const result = await getAvailableLocalesForNamespace('');

        expect(result).toEqual([]);
      });

      it('should reject namespace with special characters', async () => {
        const result = await getAvailableLocalesForNamespace('terms@special');

        expect(result).toEqual([]);
      });
    });

    describe('error handling', () => {
      it('should return empty array on filesystem error', async () => {
        mockReaddir.mockRejectedValue(new Error('Permission denied'));

        const result = await getAvailableLocalesForNamespace('error-namespace');

        expect(result).toEqual([]);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle unicode characters in namespace', async () => {
      const result = await getMDXFileContent({
        namespace: 'términos',
        locale: 'en',
      });

      // Unicode characters should fail the whitelist
      expect(result.exists).toBe(false);
    });

    it('should handle URL encoded traversal attempts', async () => {
      const result = await getMDXFileContent({
        namespace: '..%2F..%2Fetc',
        locale: 'en',
      });

      expect(result.exists).toBe(false);
    });

    it('should handle null byte injection attempts', async () => {
      const result = await getMDXFileContent({
        namespace: 'terms\0secret',
        locale: 'en',
      });

      expect(result.exists).toBe(false);
    });
  });
});
