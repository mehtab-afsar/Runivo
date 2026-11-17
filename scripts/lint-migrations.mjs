#!/usr/bin/env node
// Migration lint. Fails (exit 1) on:
//   - a file name that is not <14 digits>_<name>.sql
//   - two migrations sharing a version prefix (Supabase would apply only one)
//   - in migrations from FIRST_STRICT on: a SECURITY DEFINER function without
//     `SET search_path`, or without a REVOKE for it somewhere in the same file
//     (new functions are executable by PUBLIC/anon/authenticated by default).
// Older migrations (the consolidated feature files) are history and are only checked for naming.
//
// Usage: node scripts/lint-migrations.mjs [migrationsDir]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'supabase/migrations';
// The 13 feature files (20261118000001-13) are the consolidated history, so
// they're checked for naming only, like the archived files they replace.
const FIRST_STRICT = '20261118000014';

const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const problems = [];
const seen = new Map();

for (const f of files) {
  const m = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(f);
  if (!m) { problems.push(`${f}: name must be <14-digit version>_<snake_case>.sql`); continue; }
  const version = m[1];
  if (seen.has(version)) problems.push(`${f}: same version as ${seen.get(version)}`);
  seen.set(version, f);
  if (version < FIRST_STRICT) continue;

  const sql = readFileSync(join(dir, f), 'utf8').replace(/--[^\n]*/g, '');
  const fnRe = /create\s+(?:or\s+replace\s+)?function\s+([\w.]+)\s*\(([\s\S]*?)\)\s*returns[\s\S]*?(?=\$\$\s*;|\$[a-z_]*\$\s*;)/gi;
  let fn;
  while ((fn = fnRe.exec(sql))) {
    const [whole, name] = fn;
    // Header = everything up to the body's opening dollar quote.
    const header = whole.slice(0, whole.search(/\$[a-z_]*\$/i) === -1 ? whole.length : whole.search(/\$[a-z_]*\$/i));
    if (!/security\s+definer/i.test(header)) continue;
    if (!/set\s+search_path/i.test(header)) problems.push(`${f}: ${name} is SECURITY DEFINER without SET search_path`);
    const bare = name.split('.').pop();
    const revoke = new RegExp(`revoke\\s+(all|execute)\\s+on\\s+function\\s+(public\\.)?${bare}\\b`, 'i');
    const doLoop = /for\s+\w+\s+in[\s\S]*?pg_proc[\s\S]*?revoke/i.test(sql) && new RegExp(`['"]${bare}['"]`).test(sql);
    if (!revoke.test(sql) && !doLoop) problems.push(`${f}: ${name} is SECURITY DEFINER with no REVOKE (clients can call it by default)`);
  }
}

if (problems.length) {
  console.error(`Migration lint: ${problems.length} problem(s)\n` + problems.map(p => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`Migration lint: ${files.length} files OK`);
