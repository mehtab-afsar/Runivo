import { createClient } from 'npm:@supabase/supabase-js@2';

import { collectFilePaths, type StorageEntry } from './storageWalk.ts';
import { appleConfigFromEnv, revokeAppleSignIn } from './appleRevoke.ts';
import { deletePostHogPerson, posthogConfigFromEnv } from './posthogDelete.ts';
import { deregisterConnections, type ConnectionRow } from '../_shared/providerRevoke.ts';

// Buckets that store user-owned files under a `{userId}/...` path (RLS-scoped via
// storage.foldername(name)[1] = auth.uid()::text — see migrations 022 and 039).
// 'user-media' is referenced by the mobile gear feature but has no bucket-creation
// migration on record — cleaned up best-effort so this doesn't fail if it's absent.
const USER_MEDIA_BUCKETS = ['avatars', 'feed', 'stories', 'user-media'];

async function clearUserStorage(
  storage: ReturnType<typeof createClient>['storage'],
  userId: string
): Promise<void> {
  for (const bucket of USER_MEDIA_BUCKETS) {
    try {
      const store = storage.from(bucket);
      // Whole tree, not one level: photos sit at {userId}/{runId}/{name}.
      const paths = await collectFilePaths(async (prefix, opts) => {
        const { data, error } = await store.list(prefix, opts);
        if (error) throw error;
        return (data ?? []) as StorageEntry[];
      }, userId);
      // remove() takes a bounded batch; 100 at a time keeps requests small.
      for (let i = 0; i < paths.length; i += 100) {
        await store.remove(paths.slice(i, i + 100));
      }
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
  await clearUserStorage(supabase.storage, user.id);

  // Cut ties with outside providers while we still hold their tokens. Both are
  // best-effort and logged: a provider being down must not trap someone in an
  // account they asked to delete.
  const { data: conns } = await supabase
    .from('device_connections')
    .select('device_type, secrets, metadata')
    .eq('user_id', user.id)
    .eq('status', 'connected');
  const deviceFailures = await deregisterConnections((conns ?? []) as ConnectionRow[], (n) => Deno.env.get(n));
  if (deviceFailures.length) console.warn('[delete-account] provider deregister failed', deviceFailures);

  // Sign in with Apple (App Store 5.1.1(v), TN3194): the app re-authenticated with
  // Apple just now and sent its one-time authorization code. Revoking the token
  // removes Runivo from the runner's Apple ID "Sign in with Apple" list. A failure
  // here is reported but never blocks the deletion the runner asked for.
  let appleRevoked: boolean | null = null;
  const usedApple = ((user.app_metadata?.providers as string[] | undefined) ?? []).includes('apple');
  if (usedApple) {
    const code = await req.json().then((b: { appleAuthorizationCode?: string }) => b?.appleAuthorizationCode).catch(() => undefined);
    const cfg = appleConfigFromEnv(k => Deno.env.get(k));
    if (!code || !cfg) {
      console.warn('[delete-account] Apple token not revoked:', !code ? 'no authorization code sent' : 'APPLE_* secrets not set');
      appleRevoked = false;
    } else {
      appleRevoked = await revokeAppleSignIn(cfg, code).catch(() => false);
      if (!appleRevoked) console.warn('[delete-account] Apple token revoke failed');
    }
  }

  // Product analytics kept at PostHog under this account id (the privacy policy says
  // they go with the account). Best effort: a failure is logged, never blocks deletion.
  const phCfg = posthogConfigFromEnv(k => Deno.env.get(k));
  if (phCfg) {
    const ok = await deletePostHogPerson(phCfg, user.id).catch(() => false);
    if (!ok) console.warn('[delete-account] PostHog person not deleted');
  } else {
    console.warn('[delete-account] PostHog person not deleted: POSTHOG_* secrets not set');
  }

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

  return new Response(JSON.stringify({ success: true, appleRevoked }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
