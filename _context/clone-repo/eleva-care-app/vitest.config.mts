import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    // Environment
    environment: 'jsdom',

    // Setup files
    setupFiles: ['./tests/setup.ts'],

    // Global test API (vi, describe, it, expect)
    globals: true,

    // Include patterns
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],

    // Exclude patterns
    exclude: [
      'node_modules',
      'tests/deprecated/**',
      // E2E tests are run by Playwright, not Vitest
      'tests/e2e/**',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'html'],
      include: [
        'src/app/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}',
        'src/lib/**/*.{ts,tsx}',
        'src/server/**/*.{ts,tsx}',
      ],
      exclude: ['**/*.d.ts', '**/node_modules/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    },

    // Performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },

    // Better error reporting
    reporters: ['verbose'],

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Mock reset behavior
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,

    // Type checking for tests
    typecheck: {
      enabled: false,
    },

    // Alias configuration for tests (must be inside test block)
    alias: {
      '@/drizzle/': path.resolve(__dirname, './drizzle') + '/',
      '@/drizzle': path.resolve(__dirname, './drizzle'),
      '@/': path.resolve(__dirname, './src') + '/',
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Resolve configuration for path aliases (for non-test files)
  resolve: {
    alias: {
      '@/drizzle/': path.resolve(__dirname, './drizzle') + '/',
      '@/drizzle': path.resolve(__dirname, './drizzle'),
      '@/': path.resolve(__dirname, './src') + '/',
      '@': path.resolve(__dirname, './src'),
    },
  },
});
