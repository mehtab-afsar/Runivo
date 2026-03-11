/**
 * Runivo — Development Seed Script
 * Populates realistic data for mehtabafsar346@gmail.com
 *
 * Usage (sign up in the app first, then run):
 *   npx tsx supabase/seed.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = 'https://mlmrqtbaerdhlvrhtnry.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sbXJxdGJhZXJkaGx2cmh0bnJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA2MTg1NSwiZXhwIjoyMDg4NjM3ODU1fQ.BP15aMokuQ6AsCWYAMtZ710EPJvGq04L3hmKXF7uFGg';
const MEHTAB_EMAIL     = 'mehtabafsar346@gmail.com';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── helpers ────────────────────────────────────────────────────────────────
const log = (msg: string) => console.log(`  ${msg}`);
const ok  = (msg: string) => console.log(`  ✅ ${msg}`);
const err = (msg: string) => console.error(`  ❌ ${msg}`);

async function getOrCreateUser(email: string, password: string, username: string) {
  const { data: list } = await sb.auth.admin.listUsers();
  const existing = list?.users?.find(u => u.email === email);
  if (existing) {
    log(`user exists: ${email} (${existing.id})`);
    return existing.id;
  }
  const { data, error } = await sb.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error || !data.user) { err(`createUser ${email}: ${error?.message}`); return null; }
  log(`created user: ${email} (${data.user.id})`);
  return data.user.id;
}

// ── GPS route helpers ──────────────────────────────────────────────────────
const ts = Date.now();
function gps(points: [number, number][], startMs = ts) {
  return points.map(([lat, lng], i) => ({
    lat, lng,
    timestamp: startMs + i * 60000,
    speed: 2.8 + Math.random() * 0.4,
    accuracy: 4 + Math.floor(Math.random() * 3),
  }));
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱 Runivo seed starting...\n');

  // ── 1. Auth users ──────────────────────────────────────────────────────
  console.log('1/9  Auth users');

  const mid = await getOrCreateUser(MEHTAB_EMAIL, 'Moon@123', 'mehtabafsar346');
  if (!mid) { err('Mehtab not found — sign up first'); process.exit(1); }

  const fakeUsers = [
    { email: 'aria_speed@runivo.app',    pw: 'Seed@1234', username: 'Aria_Speed'    },
    { email: 'ironkhan@runivo.app',      pw: 'Seed@1234', username: 'IronKhan'       },
    { email: 'zoey_runs@runivo.app',     pw: 'Seed@1234', username: 'ZoeyRuns'       },
    { email: 'dev_racer@runivo.app',     pw: 'Seed@1234', username: 'DevRacer'        },
    { email: 'nightrunner99@runivo.app', pw: 'Seed@1234', username: 'NightRunner99'  },
  ];

  const ids: Record<string, string> = { mid };
  for (const u of fakeUsers) {
    const id = await getOrCreateUser(u.email, u.pw, u.username);
    if (id) ids[u.username] = id;
  }
  ok(`Auth users ready (${Object.keys(ids).length})`);

  // ── 2. Profiles ────────────────────────────────────────────────────────
  console.log('\n2/9  Profiles');

  const companions = [
    {
      id: ids['Aria_Speed'], username: 'Aria_Speed',
      level: 15, xp: 18400, coins: 3200, diamonds: 42, energy: 85,
      total_distance_km: 312.5, total_runs: 61, total_territories_claimed: 47, streak_days: 18,
      follower_count: 89, following_count: 34,
      experience_level: 'competitive', primary_goal: 'run_faster', weekly_goal_km: 60,
      playstyle: 'conqueror', mission_difficulty: 'hard', weekly_frequency: 6,
      preferred_distance: '10k', age: 24, gender: 'female', height_cm: 165, weight_kg: 54,
      bio: 'Chasing PRs every single morning 🔥 Mumbai speed queen.', location: 'Mumbai, India', avatar_color: 'rose',
      unlocked_achievements: ['first_run','streak_3','streak_7','first_territory','zone_5','zone_10','zone_25','distance_10','distance_50','distance_100','speed_demon'],
    },
    {
      id: ids['IronKhan'], username: 'IronKhan',
      level: 22, xp: 34100, coins: 7800, diamonds: 110, energy: 100,
      total_distance_km: 589.2, total_runs: 112, total_territories_claimed: 93, streak_days: 31,
      follower_count: 213, following_count: 58,
      experience_level: 'competitive', primary_goal: 'compete', weekly_goal_km: 80,
      playstyle: 'conqueror', mission_difficulty: 'hard', weekly_frequency: 7,
      preferred_distance: 'long', age: 29, gender: 'male', height_cm: 178, weight_kg: 72,
      bio: 'Laps around you while you sleep. Top 3 Delhi all-time.', location: 'New Delhi, India', avatar_color: 'indigo',
      unlocked_achievements: ['first_run','streak_3','streak_7','streak_30','first_territory','zone_5','zone_10','zone_25','zone_50','distance_10','distance_50','distance_100','distance_250','distance_500','iron_legs'],
    },
    {
      id: ids['ZoeyRuns'], username: 'ZoeyRuns',
      level: 5, xp: 2900, coins: 680, diamonds: 12, energy: 70,
      total_distance_km: 38.4, total_runs: 12, total_territories_claimed: 8, streak_days: 3,
      follower_count: 24, following_count: 19,
      experience_level: 'casual', primary_goal: 'get_fit', weekly_goal_km: 20,
      playstyle: 'explorer', mission_difficulty: 'easy', weekly_frequency: 3,
      preferred_distance: '5k', age: 21, gender: 'female', height_cm: 162, weight_kg: 58,
      bio: 'Just started running, loving every km 🌿', location: 'Bangalore, India', avatar_color: 'emerald',
      unlocked_achievements: ['first_run','streak_3','first_territory','distance_10'],
    },
    {
      id: ids['DevRacer'], username: 'DevRacer',
      level: 10, xp: 9600, coins: 1900, diamonds: 28, energy: 90,
      total_distance_km: 163.7, total_runs: 38, total_territories_claimed: 22, streak_days: 9,
      follower_count: 67, following_count: 45,
      experience_level: 'regular', primary_goal: 'explore', weekly_goal_km: 40,
      playstyle: 'explorer', mission_difficulty: 'mixed', weekly_frequency: 4,
      preferred_distance: '10k', age: 26, gender: 'male', height_cm: 172, weight_kg: 68,
      bio: 'Running + Coding = Life. Weekend warrior.', location: 'Pune, India', avatar_color: 'sky',
      unlocked_achievements: ['first_run','streak_3','streak_7','first_territory','zone_5','zone_10','distance_10','distance_50','distance_100'],
    },
    {
      id: ids['NightRunner99'], username: 'NightRunner99',
      level: 7, xp: 5200, coins: 1100, diamonds: 18, energy: 60,
      total_distance_km: 82.1, total_runs: 19, total_territories_claimed: 11, streak_days: 5,
      follower_count: 41, following_count: 30,
      experience_level: 'casual', primary_goal: 'explore', weekly_goal_km: 30,
      playstyle: 'defender', mission_difficulty: 'mixed', weekly_frequency: 3,
      preferred_distance: '5k', age: 23, gender: 'male', height_cm: 175, weight_kg: 74,
      bio: 'Only running after midnight. Streets are mine.', location: 'New Delhi, India', avatar_color: 'violet',
      unlocked_achievements: ['first_run','streak_3','first_territory','zone_5','distance_10','distance_50'],
    },
  ].filter(u => u.id);

  for (const p of companions) {
    const { error } = await sb.from('profiles').upsert({
      ...p,
      distance_unit: 'km', notifications_enabled: true,
      last_run_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      onboarding_completed_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    }, { onConflict: 'id' });
    if (error) err(`profile ${p.username}: ${error.message}`);
  }

  // Mehtab's profile
  const { error: mpErr } = await sb.from('profiles').upsert({
    id: mid, username: 'mehtabafsar346',
    level: 12, xp: 11800, coins: 2650, diamonds: 38, energy: 92,
    total_distance_km: 147.6, total_runs: 23, total_territories_claimed: 18, streak_days: 12,
    follower_count: 5, following_count: 4,
    experience_level: 'regular', primary_goal: 'compete', weekly_goal_km: 40,
    playstyle: 'conqueror', mission_difficulty: 'mixed', weekly_frequency: 5,
    preferred_distance: '10k', age: 22, gender: 'male', height_cm: 176, weight_kg: 70,
    bio: 'Conquering New Delhi one zone at a time ⚔️ Level 12 and climbing.', location: 'New Delhi, India', avatar_color: 'teal',
    unlocked_achievements: ['first_run','streak_3','streak_7','streak_10','first_territory','zone_5','zone_10','distance_10','distance_50','distance_100','conqueror','speed_demon'],
    distance_unit: 'km', notifications_enabled: true,
    last_run_date: new Date().toISOString().split('T')[0],
    onboarding_completed_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  }, { onConflict: 'id' });
  if (mpErr) err(`Mehtab profile: ${mpErr.message}`); else ok('Profiles upserted');

  // ── 3. Runs ────────────────────────────────────────────────────────────
  console.log('\n3/9  Runs');
  const now = Date.now();
  const h = 3600000;
  const d = 86400000;

  const runs = [
    // Mehtab's runs
    {
      user_id: mid, activity_type: 'run',
      started_at: new Date(now - 2*h).toISOString(), finished_at: new Date(now - 63*60000).toISOString(),
      distance_m: 10200, duration_sec: 3780, avg_pace: '6:10',
      gps_points: gps([[28.6129,77.2295],[28.6160,77.2330],[28.6200,77.2350],[28.6220,77.2300],[28.6190,77.2250],[28.6150,77.2220],[28.6110,77.2240],[28.6090,77.2280],[28.6129,77.2295]]),
      territories_claimed: ['882beac5c3fffff','882beac5c5fffff','882beac5c1fffff'],
      xp_earned: 320, coins_earned: 48, diamonds_earned: 2, enemy_captured: 1, pre_run_level: 11, calories_burned: 498,
    },
    {
      user_id: mid, activity_type: 'run',
      started_at: new Date(now - d - 7*h).toISOString(), finished_at: new Date(now - d - 6*h - 15*60000).toISOString(),
      distance_m: 7500, duration_sec: 2700, avg_pace: '6:00',
      gps_points: gps([[28.5931,77.2196],[28.5960,77.2230],[28.5990,77.2200],[28.5970,77.2160],[28.5940,77.2140],[28.5910,77.2170],[28.5931,77.2196]]),
      territories_claimed: ['882beacd19fffff','882beacd1bfffff'],
      xp_earned: 240, coins_earned: 36, diamonds_earned: 1, enemy_captured: 0, pre_run_level: 11, calories_burned: 373,
    },
    {
      user_id: mid, activity_type: 'run',
      started_at: new Date(now - 2*d - 6*h).toISOString(), finished_at: new Date(now - 2*d - 4.5*h).toISOString(),
      distance_m: 12800, duration_sec: 5400, avg_pace: '7:03',
      gps_points: gps([[28.6315,77.2195],[28.6280,77.2220],[28.6240,77.2270],[28.6200,77.2310],[28.6160,77.2330],[28.6130,77.2295],[28.6100,77.2250],[28.6140,77.2200],[28.6190,77.2190],[28.6315,77.2195]]),
      territories_claimed: ['882beac5c3fffff','882beac5c5fffff','882beac5cbfffff','882beac5c9fffff'],
      xp_earned: 450, coins_earned: 62, diamonds_earned: 3, enemy_captured: 2, pre_run_level: 11, calories_burned: 672,
    },
    {
      user_id: mid, activity_type: 'run',
      started_at: new Date(now - 3*d - 5*h).toISOString(), finished_at: new Date(now - 3*d - 4*h - 40*60000).toISOString(),
      distance_m: 5100, duration_sec: 1440, avg_pace: '4:42',
      gps_points: gps([[28.6129,77.2295],[28.6150,77.2320],[28.6170,77.2300],[28.6150,77.2270],[28.6129,77.2295]]),
      territories_claimed: ['882beac5c3fffff'],
      xp_earned: 180, coins_earned: 28, diamonds_earned: 0, enemy_captured: 0, pre_run_level: 10, calories_burned: 298,
    },
    {
      user_id: mid, activity_type: 'defend',
      started_at: new Date(now - 4*d - 7*h).toISOString(), finished_at: new Date(now - 4*d - 6*h - 5*60000).toISOString(),
      distance_m: 9300, duration_sec: 3900, avg_pace: '7:00',
      gps_points: gps([[28.6050,77.2400],[28.6080,77.2430],[28.6110,77.2460],[28.6140,77.2440],[28.6160,77.2410],[28.6140,77.2380],[28.6110,77.2370],[28.6070,77.2380],[28.6050,77.2400]]),
      territories_claimed: ['882beac5c1fffff','882beac5c7fffff'],
      xp_earned: 290, coins_earned: 42, diamonds_earned: 1, enemy_captured: 0, pre_run_level: 10, calories_burned: 490,
    },
    {
      user_id: mid, activity_type: 'run',
      started_at: new Date(now - 5*d - 5*h).toISOString(), finished_at: new Date(now - 5*d - 3*h).toISOString(),
      distance_m: 15400, duration_sec: 6600, avg_pace: '7:09',
      gps_points: gps([[28.6560,77.2300],[28.6520,77.2280],[28.6480,77.2260],[28.6440,77.2240],[28.6400,77.2220],[28.6360,77.2200],[28.6315,77.2195],[28.6280,77.2220],[28.6240,77.2240],[28.6200,77.2260],[28.6160,77.2280],[28.6129,77.2295]]),
      territories_claimed: ['882beac5c3fffff','882beac5c5fffff','882beac589fffff','882beac58bfffff'],
      xp_earned: 520, coins_earned: 72, diamonds_earned: 4, enemy_captured: 2, pre_run_level: 10, calories_burned: 812,
    },
    {
      user_id: mid, activity_type: 'attack',
      started_at: new Date(now - 7*d - 6*h).toISOString(), finished_at: new Date(now - 7*d - 5*h - 20*60000).toISOString(),
      distance_m: 6200, duration_sec: 2400, avg_pace: '6:27',
      gps_points: gps([[28.6200,77.2100],[28.6230,77.2130],[28.6250,77.2160],[28.6220,77.2190],[28.6190,77.2160],[28.6170,77.2120],[28.6200,77.2100]]),
      territories_claimed: ['882beac5cbfffff','882beac5c9fffff'],
      xp_earned: 210, coins_earned: 32, diamonds_earned: 1, enemy_captured: 1, pre_run_level: 10, calories_burned: 348,
    },
    {
      user_id: mid, activity_type: 'run',
      started_at: new Date(now - 8*d - 7*h).toISOString(), finished_at: new Date(now - 8*d - 6*h).toISOString(),
      distance_m: 8900, duration_sec: 3540, avg_pace: '6:38',
      gps_points: gps([[28.5933,77.2507],[28.5960,77.2540],[28.5990,77.2560],[28.6010,77.2530],[28.5990,77.2500],[28.5960,77.2480],[28.5933,77.2507]]),
      territories_claimed: ['882beacd03fffff'],
      xp_earned: 270, coins_earned: 40, diamonds_earned: 2, enemy_captured: 0, pre_run_level: 10, calories_burned: 466,
    },
    {
      user_id: mid, activity_type: 'run',
      started_at: new Date(now - 10*d - 8*h).toISOString(), finished_at: new Date(now - 10*d - 7*h - 35*60000).toISOString(),
      distance_m: 4500, duration_sec: 2100, avg_pace: '7:47',
      gps_points: gps([[28.5931,77.2196],[28.5950,77.2210],[28.5960,77.2190],[28.5940,77.2175],[28.5931,77.2196]]),
      territories_claimed: [],
      xp_earned: 130, coins_earned: 20, diamonds_earned: 0, enemy_captured: 0, pre_run_level: 9, calories_burned: 245,
    },
    {
      user_id: mid, activity_type: 'run',
      started_at: new Date(now - 12*d - 6*h).toISOString(), finished_at: new Date(now - 12*d - 4*h - 55*60000).toISOString(),
      distance_m: 11000, duration_sec: 4500, avg_pace: '6:49',
      gps_points: gps([[28.5494,77.2517],[28.5520,77.2550],[28.5550,77.2580],[28.5580,77.2560],[28.5590,77.2520],[28.5570,77.2490],[28.5540,77.2480],[28.5494,77.2517]]),
      territories_claimed: ['882beacd79fffff','882beacd7bfffff'],
      xp_earned: 360, coins_earned: 52, diamonds_earned: 2, enemy_captured: 1, pre_run_level: 9, calories_burned: 582,
    },
    // Companion runs
    {
      user_id: ids['Aria_Speed'], activity_type: 'run',
      started_at: new Date(now - 3*h).toISOString(), finished_at: new Date(now - 75*60000).toISOString(),
      distance_m: 14000, duration_sec: 4800, avg_pace: '5:43',
      gps_points: gps([[19.0760,72.8777],[19.0800,72.8810],[19.0840,72.8790],[19.0800,72.8750],[19.0760,72.8777]]),
      territories_claimed: ['882b95734bfffff','882b95734dfffff'],
      xp_earned: 480, coins_earned: 65, diamonds_earned: 3, enemy_captured: 0, pre_run_level: 14, calories_burned: 576,
    },
    {
      user_id: ids['IronKhan'], activity_type: 'run',
      started_at: new Date(now - d - 4*h).toISOString(), finished_at: new Date(now - d - 110*60000).toISOString(),
      distance_m: 18000, duration_sec: 6600, avg_pace: '6:07',
      gps_points: gps([[28.6400,77.2000],[28.6450,77.2050],[28.6500,77.2030],[28.6480,77.1980],[28.6400,77.2000]]),
      territories_claimed: ['882beac589fffff','882beac58bfffff','882beac5cbfffff'],
      xp_earned: 620, coins_earned: 82, diamonds_earned: 4, enemy_captured: 1, pre_run_level: 21, calories_burned: 950,
    },
    {
      user_id: ids['DevRacer'], activity_type: 'run',
      started_at: new Date(now - 2*d - 5*h).toISOString(), finished_at: new Date(now - 2*d - 4*h).toISOString(),
      distance_m: 10000, duration_sec: 3600, avg_pace: '6:00',
      gps_points: gps([[18.5204,73.8567],[18.5240,73.8600],[18.5260,73.8580],[18.5230,73.8550],[18.5204,73.8567]]),
      territories_claimed: ['88194ad0b3fffff'],
      xp_earned: 340, coins_earned: 48, diamonds_earned: 2, enemy_captured: 0, pre_run_level: 9, calories_burned: 524,
    },
  ];

  const { error: runsErr } = await sb.from('runs').insert(runs);
  if (runsErr) err(`runs: ${runsErr.message}`); else ok(`${runs.length} runs inserted`);

  // Re-stamp profile stats to desired values after trigger fired
  await sb.from('profiles').update({ total_distance_km: 147.6, total_runs: 23, total_territories_claimed: 18 }).eq('id', mid);

  // ── 4. Territories ─────────────────────────────────────────────────────
  console.log('\n4/9  Territories');
  const territories = [
    { h3_index: '882beac5c3fffff', owner_id: mid, owner_name: 'mehtabafsar346', defense: 78, tier: 'gold',   captured_at: new Date(now - 2*d).toISOString() },
    { h3_index: '882beac5c5fffff', owner_id: mid, owner_name: 'mehtabafsar346', defense: 65, tier: 'silver', captured_at: new Date(now - 3*d).toISOString() },
    { h3_index: '882beac5c1fffff', owner_id: mid, owner_name: 'mehtabafsar346', defense: 55, tier: 'bronze', captured_at: new Date(now - 4*d).toISOString() },
    { h3_index: '882beac5cbfffff', owner_id: mid, owner_name: 'mehtabafsar346', defense: 82, tier: 'gold',   captured_at: new Date(now - d).toISOString() },
    { h3_index: '882beac5c9fffff', owner_id: mid, owner_name: 'mehtabafsar346', defense: 50, tier: 'bronze', captured_at: new Date(now - 7*d).toISOString() },
    { h3_index: '882beacd19fffff', owner_id: mid, owner_name: 'mehtabafsar346', defense: 70, tier: 'silver', captured_at: new Date(now - 5*d).toISOString() },
    { h3_index: '882beac589fffff', owner_id: mid, owner_name: 'mehtabafsar346', defense: 60, tier: 'bronze', captured_at: new Date(now - 5*d).toISOString() },
    { h3_index: '882beac5c7fffff', owner_id: ids['IronKhan'], owner_name: 'IronKhan', defense: 90, tier: 'crown', captured_at: new Date(now - d).toISOString() },
    { h3_index: '882beacd1bfffff', owner_id: ids['IronKhan'], owner_name: 'IronKhan', defense: 85, tier: 'gold',  captured_at: new Date(now - 3*d).toISOString() },
    { h3_index: '882beacd03fffff', owner_id: ids['NightRunner99'], owner_name: 'NightRunner99', defense: 55, tier: 'bronze', captured_at: new Date(now - 2*d).toISOString() },
    { h3_index: '882b95734bfffff', owner_id: ids['Aria_Speed'], owner_name: 'Aria_Speed', defense: 72, tier: 'gold',  captured_at: new Date(now - 2*h).toISOString() },
  ];
  const { error: tErr } = await sb.from('territories').upsert(territories, { onConflict: 'h3_index' });
  if (tErr) err(`territories: ${tErr.message}`); else ok(`${territories.length} territories`);

  // ── 5. Follow graph ────────────────────────────────────────────────────
  console.log('\n5/9  Follows');
  const follows = [
    { follower_id: mid, following_id: ids['IronKhan'] },
    { follower_id: mid, following_id: ids['Aria_Speed'] },
    { follower_id: mid, following_id: ids['DevRacer'] },
    { follower_id: mid, following_id: ids['NightRunner99'] },
    { follower_id: ids['Aria_Speed'], following_id: mid },
    { follower_id: ids['IronKhan'],   following_id: mid },
    { follower_id: ids['ZoeyRuns'],   following_id: mid },
    { follower_id: ids['DevRacer'],   following_id: mid },
    { follower_id: ids['NightRunner99'], following_id: mid },
    { follower_id: ids['Aria_Speed'], following_id: ids['IronKhan'] },
    { follower_id: ids['IronKhan'],   following_id: ids['Aria_Speed'] },
  ].filter(f => f.follower_id && f.following_id);
  const { error: fErr } = await sb.from('followers').upsert(follows, { onConflict: 'follower_id,following_id', ignoreDuplicates: true });
  if (fErr) err(`follows: ${fErr.message}`); else ok(`${follows.length} follow edges`);

  // ── 6. Clubs ───────────────────────────────────────────────────────────
  console.log('\n6/9  Clubs');

  // We need the club IDs after insert
  const { data: clubsData, error: clubErr } = await sb.from('clubs').insert([
    { name: 'Delhi Conquerors',    description: "We don't just run — we own the map. Delhi's most feared territory squad.", badge_emoji: '⚔️', owner_id: mid, join_policy: 'invite_only', member_count: 5, total_km: 312.4 },
    { name: 'India Speed League',  description: 'Top runners from across India. Weekly challenges and territory wars.',       badge_emoji: '🏆', owner_id: ids['IronKhan'], join_policy: 'open', member_count: 4, total_km: 893.2 },
    { name: 'Night Owls Delhi',    description: 'We run when the city sleeps. Midnight to 4AM. Join us.',                    badge_emoji: '🦉', owner_id: ids['NightRunner99'], join_policy: 'open', member_count: 3, total_km: 198.5 },
    { name: 'Casual Striders',     description: 'No pressure, just fun runs. All paces welcome 🌿',                          badge_emoji: '🌿', owner_id: ids['ZoeyRuns'],   join_policy: 'open', member_count: 2, total_km: 76.8 },
  ]).select('id, name');

  if (clubErr) { err(`clubs: ${clubErr.message}`); }
  else {
    ok(`${clubsData?.length} clubs created`);
    const cids: Record<string, string> = {};
    clubsData?.forEach(c => { cids[c.name] = c.id; });

    // Club members
    const members = [
      { club_id: cids['Delhi Conquerors'],   user_id: mid,                    role: 'owner',  joined_at: new Date(now - 25*d).toISOString() },
      { club_id: cids['Delhi Conquerors'],   user_id: ids['IronKhan'],        role: 'admin',  joined_at: new Date(now - 20*d).toISOString() },
      { club_id: cids['Delhi Conquerors'],   user_id: ids['DevRacer'],        role: 'member', joined_at: new Date(now - 15*d).toISOString() },
      { club_id: cids['Delhi Conquerors'],   user_id: ids['Aria_Speed'],      role: 'member', joined_at: new Date(now - 10*d).toISOString() },
      { club_id: cids['Delhi Conquerors'],   user_id: ids['NightRunner99'],   role: 'member', joined_at: new Date(now - 5*d).toISOString() },
      { club_id: cids['India Speed League'], user_id: ids['IronKhan'],        role: 'owner',  joined_at: new Date(now - 60*d).toISOString() },
      { club_id: cids['India Speed League'], user_id: ids['Aria_Speed'],      role: 'admin',  joined_at: new Date(now - 55*d).toISOString() },
      { club_id: cids['India Speed League'], user_id: mid,                    role: 'member', joined_at: new Date(now - 18*d).toISOString() },
      { club_id: cids['India Speed League'], user_id: ids['DevRacer'],        role: 'member', joined_at: new Date(now - 12*d).toISOString() },
      { club_id: cids['Night Owls Delhi'],   user_id: ids['NightRunner99'],   role: 'owner',  joined_at: new Date(now - 30*d).toISOString() },
      { club_id: cids['Night Owls Delhi'],   user_id: mid,                    role: 'member', joined_at: new Date(now - 14*d).toISOString() },
      { club_id: cids['Night Owls Delhi'],   user_id: ids['ZoeyRuns'],        role: 'member', joined_at: new Date(now - 7*d).toISOString() },
      { club_id: cids['Casual Striders'],    user_id: ids['ZoeyRuns'],        role: 'owner',  joined_at: new Date(now - 15*d).toISOString() },
      { club_id: cids['Casual Striders'],    user_id: ids['DevRacer'],        role: 'member', joined_at: new Date(now - 8*d).toISOString() },
    ].filter(m => m.club_id && m.user_id);

    const { error: mErr } = await sb.from('club_members').upsert(members, { onConflict: 'club_id,user_id', ignoreDuplicates: true });
    if (mErr) err(`club_members: ${mErr.message}`); else ok(`${members.length} club memberships`);

    // Club messages
    const msgs = [
      { club_id: cids['Delhi Conquerors'], user_id: ids['IronKhan'],      content: '3 new zones captured near India Gate today 🗺️ Who else was out there?',             created_at: new Date(now - 3*h - 40*60000).toISOString() },
      { club_id: cids['Delhi Conquerors'], user_id: mid,                  content: 'Me! Did the full loop — 10.2km, grabbed 3 zones. IronKhan was already there lol',   created_at: new Date(now - 3*h - 20*60000).toISOString() },
      { club_id: cids['Delhi Conquerors'], user_id: ids['Aria_Speed'],    content: 'Nice work boys. Mumbai squad coming to Delhi next week, watch your zones 😈',        created_at: new Date(now - 2*h - 50*60000).toISOString() },
      { club_id: cids['Delhi Conquerors'], user_id: ids['DevRacer'],      content: 'Haha Delhi is ready. Our defenses are at 78+ on all gold zones',                    created_at: new Date(now - 2*h - 30*60000).toISOString() },
      { club_id: cids['Delhi Conquerors'], user_id: mid,                  content: "Territory war this weekend? Let's push into sector 7 together",                     created_at: new Date(now - 2*h - 10*60000).toISOString() },
      { club_id: cids['Delhi Conquerors'], user_id: ids['IronKhan'],      content: "100% in. I'll anchor the crown zone. You take the flanks",                         created_at: new Date(now - h - 50*60000).toISOString() },
      { club_id: cids['Delhi Conquerors'], user_id: ids['NightRunner99'], content: "Just woke up, catching up on this chat lol. I'm in for the weekend war",           created_at: new Date(now - 45*60000).toISOString() },
      { club_id: cids['Delhi Conquerors'], user_id: mid,                  content: "Let's go 🔥 Meeting at India Gate 6AM Saturday",                                    created_at: new Date(now - 20*60000).toISOString() },
      { club_id: cids['India Speed League'], user_id: ids['IronKhan'],    content: 'Weekly XP challenge: 5000 XP by Sunday. Top scorer gets a shoutout 🏆',            created_at: new Date(now - d - 2*h).toISOString() },
      { club_id: cids['India Speed League'], user_id: ids['Aria_Speed'],  content: "Already at 2400 XP. Let's go 💨",                                                  created_at: new Date(now - d - h).toISOString() },
      { club_id: cids['India Speed League'], user_id: mid,                content: '1560 XP here. Will hit 3000 by tonight.',                                          created_at: new Date(now - 22*h).toISOString() },
      { club_id: cids['India Speed League'], user_id: ids['DevRacer'],    content: "Nice! I'm at 980. Going for a 10k run now",                                        created_at: new Date(now - 20*h).toISOString() },
    ].filter(m => m.club_id && m.user_id);
    const { error: msgErr } = await sb.from('club_messages').insert(msgs);
    if (msgErr) err(`club_messages: ${msgErr.message}`); else ok(`${msgs.length} club messages`);
  }

  // ── 7. Feed posts + likes + comments ──────────────────────────────────
  console.log('\n7/9  Feed');

  const { data: postsData, error: postsErr } = await sb.from('feed_posts').insert([
    { user_id: mid,                  content: 'India Gate loop done ✅ 10.2km, grabbed 3 new zones. The city is mine 🗺️ #Delhi #Runivo',                  distance_km: 10.2, territories_claimed: 3, likes: 18, comment_count: 4, created_at: new Date(now - h - 30*60000).toISOString() },
    { user_id: mid,                  content: 'Early morning Lodhi Garden 🌿 7.5km easy pace. Zone defence holding strong.',                               distance_km: 7.5,  territories_claimed: 2, likes: 12, comment_count: 2, created_at: new Date(now - d - 5*h).toISOString() },
    { user_id: mid,                  content: 'Longest run this month 💪 12.8km from CP to Rajpath. 4 territories claimed, 2 taken from rivals.',         distance_km: 12.8, territories_claimed: 4, likes: 24, comment_count: 6, created_at: new Date(now - 2*d - 3*h).toISOString() },
    { user_id: ids['IronKhan'],      content: '18km this morning. Delhi is too small for me. Expanding into sector 12. 👑 #IronKhan #Territory',          distance_km: 18.0, territories_claimed: 3, likes: 31, comment_count: 7, created_at: new Date(now - d - 2*h).toISOString() },
    { user_id: ids['Aria_Speed'],    content: 'Mumbai mode: activated 🔥 14km sub-6min pace. Zones loading... #SpeedQueen',                              distance_km: 14.0, territories_claimed: 2, likes: 27, comment_count: 5, created_at: new Date(now - 2*h).toISOString() },
    { user_id: ids['ZoeyRuns'],      content: 'First 5km done!! Legs feel like jelly but I love it 😅 #NewRunner #ZoeyRuns',                             distance_km: 5.0,  territories_claimed: 1, likes: 14, comment_count: 3, created_at: new Date(now - 2*d - 8*h).toISOString() },
    { user_id: ids['NightRunner99'], content: 'Midnight run complete. 8km through empty Delhi streets. Most beautiful city at 2AM 🌙',                  distance_km: 8.0,  territories_claimed: 2, likes: 19, comment_count: 4, created_at: new Date(now - 3*d).toISOString() },
    { user_id: ids['DevRacer'],      content: 'Pune lakeside 10k done. Personal best pace: 5:48/km 💥 Getting faster every week!',                       distance_km: 10.0, territories_claimed: 1, likes: 22, comment_count: 3, created_at: new Date(now - 2*d - 4*h).toISOString() },
  ]).select('id, user_id');

  if (postsErr) err(`feed_posts: ${postsErr.message}`);
  else {
    ok(`${postsData?.length} feed posts`);
    const [p1, p2, p3, p4, p5] = postsData!;

    // Likes
    const likes = [
      { post_id: p1.id, user_id: ids['IronKhan'],      created_at: new Date(now - h).toISOString() },
      { post_id: p1.id, user_id: ids['Aria_Speed'],    created_at: new Date(now - 55*60000).toISOString() },
      { post_id: p1.id, user_id: ids['DevRacer'],      created_at: new Date(now - 45*60000).toISOString() },
      { post_id: p2.id, user_id: ids['NightRunner99'], created_at: new Date(now - d - 4*h).toISOString() },
      { post_id: p3.id, user_id: ids['IronKhan'],      created_at: new Date(now - 2*d).toISOString() },
      { post_id: p3.id, user_id: ids['Aria_Speed'],    created_at: new Date(now - 2*d + h).toISOString() },
      { post_id: p4.id, user_id: mid,                  created_at: new Date(now - d - h).toISOString() },
      { post_id: p4.id, user_id: ids['Aria_Speed'],    created_at: new Date(now - d).toISOString() },
      { post_id: p5.id, user_id: mid,                  created_at: new Date(now - h - 30*60000).toISOString() },
      { post_id: p5.id, user_id: ids['DevRacer'],      created_at: new Date(now - h - 20*60000).toISOString() },
    ].filter(l => l.post_id && l.user_id);
    await sb.from('feed_post_likes').upsert(likes, { onConflict: 'post_id,user_id', ignoreDuplicates: true });

    // Comments
    const comments = [
      { post_id: p1.id, user_id: ids['IronKhan'],   content: "Watch out mehtab, I'm taking those back tonight 😤",          created_at: new Date(now - h - 20*60000).toISOString() },
      { post_id: p1.id, user_id: ids['Aria_Speed'], content: 'Clean route! I do the same loop in Mumbai vibes 🔥',           created_at: new Date(now - h).toISOString() },
      { post_id: p1.id, user_id: ids['DevRacer'],   content: 'Drop the zone defense strat!',                                created_at: new Date(now - 50*60000).toISOString() },
      { post_id: p1.id, user_id: mid,               content: 'Defense at 78+ on all gold zones. Try me IronKhan 💪',         created_at: new Date(now - 40*60000).toISOString() },
      { post_id: p3.id, user_id: ids['IronKhan'],   content: 'Solid distance. Your stamina is leveling up fast.',           created_at: new Date(now - 2*d).toISOString() },
      { post_id: p3.id, user_id: ids['Aria_Speed'], content: '12.8km no cap 🔥',                                            created_at: new Date(now - 2*d + 30*60000).toISOString() },
      { post_id: p4.id, user_id: mid,               content: 'Delhi always has someone ready to defend 😤',                  created_at: new Date(now - d).toISOString() },
    ].filter(c => c.post_id && c.user_id);
    const { error: cErr } = await sb.from('feed_post_comments').insert(comments);
    if (cErr) err(`comments: ${cErr.message}`); else ok(`${comments.length} comments`);
  }

  // ── 8. Events ──────────────────────────────────────────────────────────
  console.log('\n8/9  Events');
  const { data: eventsData, error: evErr } = await sb.from('events').insert([
    { title: 'Delhi Territory War — Week 3',      description: 'All Delhi runners: claim as many zones as possible within 48 hours. XP multiplier active. Top 3 get a diamond drop.', event_type: 'territory-war',  starts_at: new Date(now + 2*d).toISOString(), ends_at: new Date(now + 4*d).toISOString(), location_name: 'India Gate, New Delhi',          participant_count: 47, xp_multiplier: 2.0 },
    { title: '10K Community Run — Lodhi Garden',   description: 'Free group run every Sunday morning. All paces welcome. Meet at the main gate.',                                        event_type: 'community-run',  starts_at: new Date(now + 5*d).toISOString(), ends_at: new Date(now + 5*d + 2*h).toISOString(), location_name: 'Lodhi Garden, New Delhi',       distance_m: 10000, participant_count: 23, xp_multiplier: 1.5 },
    { title: 'India Speed League — Sprint Challenge', description: 'Fastest 5km wins. Must be GPS tracked. Register by Friday.',                                                         event_type: 'race',           starts_at: new Date(now + 8*d).toISOString(), ends_at: new Date(now + 8*d + 3*h).toISOString(), location_name: 'Connaught Place, New Delhi',    distance_m: 5000, participant_count: 15, xp_multiplier: 1.8 },
  ]).select('id');
  if (evErr) err(`events: ${evErr.message}`);
  else {
    ok(`${eventsData?.length} events`);
    const [ev1, ev2, ev3] = eventsData!;
    const participants = [
      { event_id: ev1.id, user_id: mid },
      { event_id: ev1.id, user_id: ids['IronKhan'] },
      { event_id: ev1.id, user_id: ids['Aria_Speed'] },
      { event_id: ev1.id, user_id: ids['DevRacer'] },
      { event_id: ev2.id, user_id: mid },
      { event_id: ev2.id, user_id: ids['ZoeyRuns'] },
      { event_id: ev2.id, user_id: ids['NightRunner99'] },
      { event_id: ev3.id, user_id: ids['Aria_Speed'] },
      { event_id: ev3.id, user_id: ids['IronKhan'] },
      { event_id: ev3.id, user_id: mid },
    ].filter(p => p.event_id && p.user_id);
    await sb.from('event_participants').upsert(participants, { onConflict: 'event_id,user_id', ignoreDuplicates: true });
    ok(`${participants.length} event participants`);
  }

  // ── 9. Notifications ───────────────────────────────────────────────────
  console.log('\n9/9  Notifications');
  const notifs = [
    { user_id: mid, type: 'kudos',             title: 'IronKhan liked your post',        body: '10.2km India Gate loop 👍',                              read: false, action_url: '/feed' },
    { user_id: mid, type: 'kudos',             title: 'Aria_Speed liked your post',      body: 'Nice route through CP! 🔥',                              read: false, action_url: '/feed' },
    { user_id: mid, type: 'territory_claimed', title: 'Zone captured!',                  body: 'You claimed 882beac5c3fffff near India Gate.',            read: true,  action_url: '/territory-map' },
    { user_id: mid, type: 'territory_lost',    title: 'Zone under attack!',              body: 'IronKhan is attacking your zone 882beac5c5fffff',        read: false, action_url: '/territory-map' },
    { user_id: mid, type: 'club_join',         title: 'NightRunner99 joined your club',  body: 'NightRunner99 joined Delhi Conquerors.',                 read: false, action_url: '/club' },
    { user_id: mid, type: 'streak',            title: '12-day streak! 🔥',              body: "You're on fire. Keep it up!",                            read: false, action_url: '/profile' },
    { user_id: mid, type: 'event_reminder',    title: 'Delhi Territory War starts in 2 days', body: 'Get ready to conquer!',                            read: false, action_url: '/events' },
    { user_id: mid, type: 'system',            title: 'Level 12 reached!',              body: 'You unlocked the Conqueror badge 🏆',                    read: true,  action_url: '/profile' },
  ];
  const { error: nErr } = await sb.from('notifications').insert(notifs);
  if (nErr) err(`notifications: ${nErr.message}`); else ok(`${notifs.length} notifications`);

  console.log('\n🎉 Seed complete! Open the app and log in as mehtabafsar346@gmail.com\n');
}

main().catch(e => { console.error(e); process.exit(1); });
