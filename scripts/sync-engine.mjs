// Generates supabase/functions/_shared/runEngine.ts from the app's engine.
//
// packages/shared/src/engine/runEngine.ts is the only copy anyone edits. The edge
// functions need a file inside supabase/functions/ to be bundled by
// `supabase functions deploy`, so the server copy is generated, git-ignored and
// never edited or committed.
//
//   node scripts/sync-engine.mjs               write the copy (npm run engine:sync)
//   node scripts/sync-engine.mjs --check       fail, with a diff, if it is missing or stale
//   node scripts/sync-engine.mjs --if-present  like the first, but a no-op when the source
//                                              is absent (postinstall in a partial checkout)
//
// Runs on `postinstall`, in `npm run functions:deploy`, and in CI before `deno check`.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'packages/shared/src/engine/runEngine.ts');
const DEST = resolve(root, 'supabase/functions/_shared/runEngine.ts');
const rel = (p) => p.slice(root.length + 1);

const args = new Set(process.argv.slice(2));

if (!existsSync(SRC)) {
  if (args.has('--if-present')) process.exit(0);
  console.error(`engine source not found: ${rel(SRC)}`);
  process.exit(1);
}

if (args.has('--check')) {
  if (!existsSync(DEST)) {
    console.error(`${rel(DEST)} is missing. Run: npm run engine:sync`);
    process.exit(1);
  }
  if (readFileSync(SRC, 'utf8') !== readFileSync(DEST, 'utf8')) {
    console.error(`${rel(DEST)} is stale. Run: npm run engine:sync\n`);
    spawnSync('diff', ['-u', SRC, DEST], { stdio: 'inherit' });
    process.exit(1);
  }
  console.log(`${rel(DEST)} matches ${rel(SRC)}`);
  process.exit(0);
}

mkdirSync(dirname(DEST), { recursive: true });
copyFileSync(SRC, DEST);
console.log(`engine: ${rel(SRC)} -> ${rel(DEST)}`);
