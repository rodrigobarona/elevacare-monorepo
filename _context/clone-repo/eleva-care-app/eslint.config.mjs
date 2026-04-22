// eslint.config.mjs - Consolidated Next.js 16 Configuration
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Global ignores (replaces .eslintignore)
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '**/node_modules/**',
    'coverage/**',
    '**/dist/**',
    '.source/**', // Generated Fumadocs output
    // Migrated from .eslintignore
    'migrate-to-workos.js',
    'migrate-clerk-to-workos.sh',
    'scripts/utilities/find-unused-components.js',
    'scripts/utilities/fix-shared-exports.js',
    'scripts/apply-rls-final.ts',
  ]),

  // Base rules for all files
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/no-unescaped-entities': 'off', // Allow quotes in JSX text
      // React Compiler rules - downgrade to warnings for legitimate patterns
      'react-hooks/set-state-in-effect': 'warn', // Allow setState in effects for hydration safety
      'react-hooks/immutability': 'warn', // Allow function hoisting patterns
      'react-hooks/incompatible-library': 'warn', // Allow TanStack Table and similar libraries
    },
  },

  // Novu workflow protection (migrated from .eslintrc.cjs)
  {
    // Apply to all files except the Novu webhook handler
    ignores: ['**/api/webhooks/novu/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.property.name="trigger"][callee.object.name=/.*[Ww]orkflow$/]',
          message:
            'Direct workflow.trigger() calls cause 401 errors. Use triggerWorkflow() from @/app/utils/novu instead.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/config/novu'],
              message: 'For triggering workflows, use @/app/utils/novu instead.',
            },
          ],
        },
      ],
    },
  },

  // Test files - relaxed rules
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', 'tests/**/*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
]);

export default eslintConfig;
