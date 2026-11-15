/**
 * Mission rewards exist twice: MISSION_TEMPLATES (what the app shows) and the SQL function
 * mission_pace_reward() (what the server pays when a mission is claimed). If they differ, the
 * app promises one amount and the server credits another, or credits nothing (NULL).
 * This reads the latest migration that defines the function and compares.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MISSION_TEMPLATES } from './missions';

const MIGRATIONS = resolve(__dirname, '../../../../supabase/migrations');

function latestSqlRewards(): Map<string, number> {
  const files = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();
  let body = '';
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    const m = /create\s+(?:or\s+replace\s+)?function\s+public\.mission_pace_reward[\s\S]*?\$\$([\s\S]*?)\$\$/i.exec(sql);
    if (m) body = m[1];
  }
  const rewards = new Map<string, number>();
  for (const w of body.matchAll(/WHEN\s+'([^']+)'\s+THEN\s+(\d+)/gi)) rewards.set(w[1], Number(w[2]));
  return rewards;
}

describe('mission rewards: app and server agree', () => {
  const sql = latestSqlRewards();

  it('reads the SQL table', () => {
    expect(sql.size).toBeGreaterThan(10);
  });

  it.each(MISSION_TEMPLATES.map(t => [t.title, t.rewards.pace] as const))(
    '%s pays the same amount in SQL',
    (title, pace) => {
      expect(sql.get(title), `mission_pace_reward() has no entry for "${title}"`).toBe(pace);
    },
  );

  it('SQL has no mission the app does not know', () => {
    const titles = new Set(MISSION_TEMPLATES.map(t => t.title));
    expect([...sql.keys()].filter(k => !titles.has(k))).toEqual([]);
  });
});
