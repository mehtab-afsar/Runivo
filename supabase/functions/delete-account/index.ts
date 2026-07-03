import { createClient } from 'npm:@supabase/supabase-js@2';

// Buckets that store user-owned files under a `{userId}/...` path (RLS-scoped via
// storage.foldername(name)[1] = auth.uid()::text — see migrations 022 and 039).
// 'user-media' is referenced by the mobile gear feature but has no bucket-creation
// migration on record — cleaned up best-effort so this doesn't fail if it's absent.
const USER_MEDIA_BUCKETS = ['avatars', 'feed', 'stories', 'user-media'];

async function clearUserStorage(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<void> {
  for (const bucket of USER_MEDIA_BUCKETS) {
    try {
      const { data: files, error: listErr } = await supabase.storage.from(bucket).list(userId);
      if (listErr || !files || files.length === 0) continue;
      const paths = files.map(f => `${userId}/${f.name}`);
      await supabase.storage.from(bucket).remove(paths);
    } catch {
      // Best-effort — a missing/misconfigured bucket must not block account deletion.
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  // Service-role client throughout — used first to validate the caller's own JWT
  // (never trust a client-supplied user id), then for storage cleanup and the
  // privileged admin.deleteUser call. Same pattern as process-run-territory.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) return new Response('Unauthorized', { status: 401 });

  // Storage cleanup BEFORE the irreversible deleteUser call below — if this throws,
  // the user account still exists and the client can show an error instead of the
  // user being deleted with orphaned files left behind silently either way.
  await clearUserStorage(supabase, user.id);

  // Cascades through ~30 tables (runs, territory_polygons, mission_progress,
  // saved_routes, feed_posts, followers, coach_messages, etc. — all
  // ON DELETE CASCADE from profiles(id)/auth.users(id)). The legacy H3 `territories`
  // table has ON DELETE SET NULL instead and is left orphaned — acceptable, it's
  // dead/superseded data.
  const { error: deleteErr } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteErr) {
    return new Response(JSON.stringify({ error: deleteErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
