// Guards for the territory SQL (audit T1-T3, T11, T13, T14), without a database.
// The real PostGIS checks live in supabase/tests; these fail fast if a later
// migration redefines a function and brings the bugs back.
//
// T1-T3: territory_polygons.geom is rebuilt from polygon_coords, which keeps only
// a polygon's OUTER ring. So every piece stored by claim_unclaimed_area and
// steal_territory_portion must be hole-free (public.hole_free_parts), or the
// stored zone silently covers its hole: a big loop run as a strip owned the
// whole park, a steal through a zone's middle gave the ground back to the
// rival, and a loop around someone's zone swallowed it.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '..', '..', 'migrations');
const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();

/** The body of the newest definition of a function across all migrations. */
function latestBody(name: string): string {
  let body = '';
  const re = new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`, 'g');
  for (const f of files) {
    const sql = readFileSync(join(DIR, f), 'utf8');
    for (const m of sql.matchAll(re)) body = m[1];
  }
  return body;
}

describe('territory SQL: pieces are stored hole-free (T1-T3)', () => {
  for (const fn of ['claim_unclaimed_area', 'steal_territory_portion']) {
    it(`${fn} stores only hole_free_parts`, () => {
      const body = latestBody(fn);
      expect(body).not.toBe('');
      // Every loop that stores outer rings must iterate hole-free parts…
      expect(body).toMatch(/hole_free_parts\(/);
      // …and none may dump a geometry that can carry holes straight into a row.
      expect(body).not.toMatch(/ST_Dump\(ST_CollectionExtract\((v_free|stolen_geom|remain_geom)/);
    });
  }

  it('hole_free_parts cuts until no interior ring is left', () => {
    const body = latestBody('hole_free_parts');
    expect(body).toMatch(/ST_NumInteriorRings\(p\) = 0/);
    expect(body).toMatch(/ST_Split\(/);
  });
});

describe('territory SQL: other fixes stay in', () => {
  it('stale-zone count uses decayed freshness (T11)', () => {
    expect(latestBody('count_defendable_stale_zones')).toMatch(/EXTRACT\(EPOCH FROM \(now\(\) - last_defended_at\)\)/);
  });
  it('claims and steals take the territory lock (T13)', () => {
    for (const fn of ['claim_unclaimed_area', 'steal_territory_portion', 'apply_run_territory']) {
      expect(latestBody(fn)).toMatch(/pg_advisory_xact_lock\(hashtext\('runivo_territory'\)\)/);
    }
  });
  it('one run writes its territory in one transaction and records the stage (T14)', () => {
    expect(latestBody('apply_run_territory')).toMatch(/UPDATE public\.run_processing SET stage/);
  });
});
