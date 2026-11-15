import { adminRoute, serviceClient, json } from '@/lib/adminServer';

export const dynamic = 'force-dynamic';

/**
 * The moderation queue (App Store Guideline 1.2: reports must reach someone who
 * acts on them). One list across every kind of report, grouped by what was
 * reported, so a moderator sees "this comment, 3 reports" once.
 *
 *   GET  /api/admin/moderation                          -> open items, oldest first
 *   POST /api/admin/moderation {source, target_id, action}
 *        action: 'dismiss' | 'remove' | 'remove_and_ban'
 */

const SOURCES = ['comment', 'club', 'event', 'post', 'user', 'club_message'] as const;
type Source = (typeof SOURCES)[number];
const ACTIONS = ['dismiss', 'remove', 'remove_and_ban'] as const;
type Action = (typeof ACTIONS)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Item {
  key: string;
  source: Source;
  target_id: string;
  report_count: number;
  reasons: string[];
  first_reported_at: string;
  preview: string | null;
  author_id: string | null;
  author_username: string | null;
}

type Db = ReturnType<typeof serviceClient>;

/** Each report table: where it lives, which column names its target, what a target is. */
const REPORTS: Record<Source, { table: string; targetCol: string }> = {
  comment:      { table: 'content_reports',      targetCol: 'target_id' },
  club:         { table: 'content_reports',      targetCol: 'target_id' },
  event:        { table: 'content_reports',      targetCol: 'target_id' },
  post:         { table: 'post_reports',         targetCol: 'post_id' },
  user:         { table: 'user_reports',         targetCol: 'target_user_id' },
  club_message: { table: 'club_message_reports', targetCol: 'message_id' },
};

/** The content itself, and who made it, for the sources that have one. */
const CONTENT: Record<Source, { table: string; text: string | null; author: string | null; removable: boolean }> = {
  comment:      { table: 'feed_post_comments', text: 'content',     author: 'user_id',  removable: true },
  club:         { table: 'clubs',              text: 'name',        author: 'owner_id', removable: true },
  event:        { table: 'events',             text: 'title',       author: null,       removable: true },
  post:         { table: 'feed_posts',         text: 'content',     author: 'user_id',  removable: true },
  user:         { table: 'profiles',           text: 'username',    author: 'id',       removable: false },
  club_message: { table: 'lobby_messages',     text: 'content',     author: 'user_id',  removable: true },
};

async function authorOf(db: Db, source: Source, id: string): Promise<string | null> {
  const c = CONTENT[source];
  if (!c.author) return null;
  const { data } = await db.from(c.table).select(c.author).eq('id', id).maybeSingle();
  return ((data as Record<string, string> | null)?.[c.author]) ?? null;
}

export const GET = adminRoute(async () => {
  const db = serviceClient();

  type Row = { source: Source; target: string; reason: string; at: string };
  const rows: Row[] = [];

  const content = await db.from('content_reports').select('target_type, target_id, reason, created_at').eq('status', 'open').order('created_at').limit(500);
  for (const r of content.data ?? []) rows.push({ source: r.target_type as Source, target: r.target_id, reason: r.reason, at: r.created_at });
  const posts = await db.from('post_reports').select('post_id, reason, created_at').eq('status', 'open').order('created_at').limit(500);
  for (const r of posts.data ?? []) rows.push({ source: 'post', target: r.post_id, reason: r.reason, at: r.created_at });
  const users = await db.from('user_reports').select('target_user_id, reason, created_at').eq('status', 'open').order('created_at').limit(500);
  for (const r of users.data ?? []) rows.push({ source: 'user', target: r.target_user_id, reason: r.reason, at: r.created_at });
  const msgs = await db.from('club_message_reports').select('message_id, reason, created_at').eq('status', 'open').order('created_at').limit(500);
  for (const r of msgs.data ?? []) rows.push({ source: 'club_message', target: r.message_id, reason: r.reason, at: r.created_at });

  const grouped = new Map<string, Item>();
  for (const r of rows) {
    const key = `${r.source}:${r.target}`;
    const g = grouped.get(key);
    if (g) {
      g.report_count += 1;
      if (!g.reasons.includes(r.reason)) g.reasons.push(r.reason);
      if (r.at < g.first_reported_at) g.first_reported_at = r.at;
    } else {
      grouped.set(key, { key, source: r.source, target_id: r.target, report_count: 1, reasons: [r.reason], first_reported_at: r.at, preview: null, author_id: null, author_username: null });
    }
  }
  const items = [...grouped.values()];

  // Fill in what was reported and who wrote it, one query per kind of content.
  for (const source of SOURCES) {
    const mine = items.filter(i => i.source === source);
    if (!mine.length) continue;
    const c = CONTENT[source];
    const cols = ['id', c.text, c.author].filter((x, i, a): x is string => !!x && a.indexOf(x) === i).join(', ');
    const { data } = await db.from(c.table).select(cols).in('id', mine.map(i => i.target_id));
    const byId = new Map((data as unknown as Record<string, string>[] | null ?? []).map(d => [d.id, d]));
    for (const i of mine) {
      const d = byId.get(i.target_id);
      i.preview = d && c.text ? String(d[c.text] ?? '').slice(0, 300) : null;
      i.author_id = d && c.author ? d[c.author] ?? null : null;
    }
  }
  const authorIds = [...new Set(items.map(i => i.author_id).filter((x): x is string => !!x))];
  if (authorIds.length) {
    const { data } = await db.from('profiles').select('id, username').in('id', authorIds);
    const names = new Map((data ?? []).map(p => [p.id as string, p.username as string | null]));
    for (const i of items) i.author_username = i.author_id ? names.get(i.author_id) ?? null : null;
  }

  items.sort((a, b) => a.first_reported_at.localeCompare(b.first_reported_at));
  return json({ items });
});

export const POST = adminRoute(async (req) => {
  const body = (await req.json().catch(() => ({}))) as { source?: unknown; target_id?: unknown; action?: unknown };
  const source = SOURCES.find(s => s === body.source);
  const action = ACTIONS.find(a => a === body.action) as Action | undefined;
  const targetId = typeof body.target_id === 'string' && UUID.test(body.target_id) ? body.target_id : null;
  if (!source || !action || !targetId) return json({ error: 'source, target_id and action are required' }, 400);

  const db = serviceClient();
  const content = CONTENT[source];

  if (action !== 'dismiss') {
    // The author is looked up first: once the content is deleted it cannot be.
    const author = await authorOf(db, source, targetId);

    if (action === 'remove_and_ban') {
      if (!author) return json({ error: 'No author to suspend for this item' }, 400);
      const { error } = await db.from('user_bans').upsert({ user_id: author, reason: `Moderation: ${source} ${targetId}` });
      if (error) return json({ error: error.message }, 400);
    }
    if (content.removable) {
      const { error } = await db.from(content.table).delete().eq('id', targetId);
      if (error) return json({ error: error.message }, 400);
    } else if (action === 'remove') {
      return json({ error: 'A runner cannot be removed here. Use remove_and_ban to suspend them.' }, 400);
    }
  }

  const report = REPORTS[source];
  let q = db.from(report.table).update({ status: action === 'dismiss' ? 'dismissed' : 'actioned' }).eq(report.targetCol, targetId).eq('status', 'open');
  if (report.table === 'content_reports') q = q.eq('target_type', source);
  const { error } = await q;
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
});
