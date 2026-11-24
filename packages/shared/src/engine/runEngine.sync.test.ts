import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// runEngine.ts here is the only copy anyone edits. The edge functions import a
// generated, git-ignored copy at supabase/functions/_shared/runEngine.ts (Deno can't
// reach into the app's workspace, and `supabase functions deploy` only bundles files
// under supabase/functions). If the copy is stale the server pays different PACE than
// the app shows, so this fails: run `npm run engine:sync`.
describe('runEngine server copy', () => {
  it('exists and is identical to the app copy', () => {
    const serverPath = resolve(__dirname, '../../../../supabase/functions/_shared/runEngine.ts');
    expect(existsSync(serverPath), 'missing: run `npm run engine:sync`').toBe(true);
    const app = readFileSync(resolve(__dirname, 'runEngine.ts'), 'utf8');
    expect(readFileSync(serverPath, 'utf8'), 'stale: run `npm run engine:sync`').toBe(app);
  });
});
