import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';

// One entry per folder in apps/mobile/src/features. Add a new feature here too.
const FEATURES = [
  'auth', 'challenges', 'clubs', 'coach', 'dashboard', 'events', 'gear', 'goals', 'history', 'leaderboard',
  'missions', 'notifications', 'nutrition', 'profile', 'run', 'settings', 'social', 'store', 'subscription',
  'territory', 'training',
];

const compat = new FlatCompat({ baseDirectory: fileURLToPath(new URL('.', import.meta.url)) });

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/ios/**',
      '**/android/**',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/*.config.cjs',
      'apps/mobile/patches/**',
      '.claude/**',
    ],
  },

  // ── apps/mobile + packages/shared: plain TS/React Native rules ──────────────
  {
    files: ['apps/mobile/src/**/*.{ts,tsx}', 'packages/shared/src/**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks, react },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '19' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Zero console.log in mobile/shared production paths is an existing,
      // already-followed convention — this just makes it enforced instead of
      // relying on code review to catch it.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Metro's bundler requires require() for local asset paths (sounds/images) —
      // dynamic import() doesn't work for its static asset analysis. This is the
      // standard, necessary RN pattern, not a code smell.
      '@typescript-eslint/no-require-imports': 'off',
      // Both workspaces lean on this pattern extensively and deliberately
      // (refs-over-state to dodge stale closures) — downgraded to a warning
      // rather than off, so genuine mistakes still surface without breaking
      // the many correct, already-audited exhaustive-deps exceptions.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // ── Feature boundaries (warn only: the count is the to-do list) ─────────────
  // A feature may import from itself, from src/shared, src/theme and packages/shared,
  // but not reach into another feature's folders. Each such import is a coupling the
  // restructure in docs/AUDIT_2026-11.md has to untangle (it caused the run⇄settings,
  // social⇄clubs and profile⇄social cycles). Move the shared piece to src/shared (UI,
  // helpers) or give it a home in the feature that owns it and import that.
  ...FEATURES.map(feature => ({
    files: [`apps/mobile/src/features/${feature}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [{
          group: ['@features/*', `!@features/${feature}`, `!@features/${feature}/**`],
          message: `Cross-feature import from "${feature}". Move the shared code to src/shared, or to the feature that owns it.`,
        }],
      }],
    },
  })),

  // ── apps/web: Next.js's own rules (core-web-vitals + TS) via FlatCompat ─────
  ...compat.extends('next/core-web-vitals', 'next/typescript').map(cfg => ({
    ...cfg,
    files: ['apps/web/app/**/*.{ts,tsx}', 'apps/web/components/**/*.{ts,tsx}', 'apps/web/lib/**/*.{ts,tsx}'],
  })),
);
