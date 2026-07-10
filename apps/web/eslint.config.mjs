import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

// Next's own build-time lint step (next build / next lint) resolves its config
// starting from this directory, not the monorepo root — it didn't detect the
// Next plugin when only the root-level eslint.config.mjs declared it (that one
// still exists and is what `npm run lint` from the repo root uses; this local
// config is specifically what `next build`'s internal linting picks up).
const compat = new FlatCompat({ baseDirectory: fileURLToPath(new URL('.', import.meta.url)) });

export default [...compat.extends('next/core-web-vitals', 'next/typescript')];
