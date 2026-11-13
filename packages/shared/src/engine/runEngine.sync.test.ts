import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The server runs its own copy of the engine (Deno can't import from the app's
// workspace). They must never drift: run `npm run engine:sync` after editing.
describe('runEngine server copy', () => {
  it('is identical to the app copy', () => {
    const app = readFileSync(resolve(__dirname, 'runEngine.ts'), 'utf8');
    const server = readFileSync(resolve(__dirname, '../../../../supabase/functions/_shared/runEngine.ts'), 'utf8');
    expect(server).toBe(app);
  });
});
