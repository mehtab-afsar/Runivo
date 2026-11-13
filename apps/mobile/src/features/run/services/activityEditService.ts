import { supabase } from '@shared/services/supabase';
import { getRunById, saveRun, deleteRun } from '@shared/services/store';

/** Who can see an activity (20261112000004_activity_edit.sql). */
export type Audience = 'everyone' | 'followers' | 'only_me';

export const AUDIENCES: { id: Audience; label: string; sub: string }[] = [
  { id: 'everyone',  label: 'Everyone',  sub: 'Anyone on Runivo, including Discover' },
  { id: 'followers', label: 'Followers', sub: 'Only people who follow you' },
  { id: 'only_me',   label: 'Only you',  sub: 'Nobody else sees it' },
];

export interface ActivityEdit {
  title: string;
  description: string;
  privateNotes: string;
  perceivedEffort: number | null;
  visibility: Audience;
  photos: ActivityPhoto[];
  /** "Don't count this": left out of stats, leaderboards and records. */
  excluded: boolean;
  integrityStatus: 'ok' | 'flagged' | 'appealed' | 'cleared';
  integrityReason: 'teleport' | 'vehicle' | null;
}

/** What was saved when the sheet opened, to know what changed. */
const opened = new Map<string, { paths: string[]; excluded: boolean }>();

export async function fetchActivityEdit(runId: string): Promise<ActivityEdit> {
  const local = await getRunById(runId);
  const [{ data: run }, { data: post }] = await Promise.all([
    supabase.from('runs').select('title, description, private_notes, perceived_effort, photo_paths, excluded, integrity_status, integrity_reason').eq('id', runId).maybeSingle(),
    supabase.from('feed_posts').select('visibility').eq('run_id', runId).limit(1).maybeSingle(),
  ]);
  const paths = (run?.photo_paths as string[] | null) ?? local?.photoPaths ?? [];
  const excluded = (run?.excluded as boolean | null) ?? local?.excluded ?? false;
  opened.set(runId, { paths, excluded });
  return {
    photos:          paths.map(path => ({ path, uri: photoUrl(path) })),
    excluded,
    integrityStatus: (run?.integrity_status as ActivityEdit['integrityStatus'] | null) ?? local?.integrityStatus ?? 'ok',
    integrityReason: (run?.integrity_reason as ActivityEdit['integrityReason']) ?? local?.integrityReason ?? null,
    title:           (run?.title as string | null) ?? local?.title ?? '',
    description:     (run?.description as string | null) ?? local?.description ?? '',
    privateNotes:    (run?.private_notes as string | null) ?? local?.privateNotes ?? '',
    perceivedEffort: (run?.perceived_effort as number | null) ?? local?.perceivedEffort ?? null,
    visibility:      ((post?.visibility as Audience | null) ?? local?.visibility ?? 'everyone'),
  };
}

/** Saves on the server, then on the device. Throws if the run has not reached the server yet. */
export async function saveActivityEdit(runId: string, e: ActivityEdit): Promise<void> {
  const { data, error } = await supabase.rpc('update_activity', {
    p_run_id: runId,
    p_title: e.title,
    p_description: e.description,
    p_visibility: e.visibility,
    p_perceived_effort: e.perceivedEffort,
    p_private_notes: e.privateNotes,
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error('not_synced');

  const was = opened.get(runId) ?? { paths: [], excluded: false };
  const samePhotos = e.photos.length === was.paths.length && e.photos.every((p, i) => p.path === was.paths[i]);
  const photoPaths = samePhotos ? was.paths : await savePhotos(runId, was.paths, e.photos);
  if (e.excluded !== was.excluded) {
    const { error: exErr } = await supabase.rpc('set_activity_excluded', { p_run_id: runId, p_excluded: e.excluded });
    if (exErr) throw new Error(exErr.message);
  }
  opened.set(runId, { paths: photoPaths, excluded: e.excluded });

  const local = await getRunById(runId);
  if (local) {
    await saveRun({
      ...local,
      title: e.title.trim() || null,
      description: e.description.trim() || null,
      privateNotes: e.privateNotes.trim() || null,
      perceivedEffort: e.perceivedEffort,
      visibility: e.visibility,
      photoPaths,
      excluded: e.excluded,
    });
  }
}

/** Removes the activity and its post. Zones it claimed and PACE it earned stay. */
export async function deleteActivity(runId: string): Promise<void> {
  const local = await getRunById(runId);
  if (local?.synced !== false) {
    const { error } = await supabase.rpc('delete_activity', { p_run_id: runId });
    if (error) throw new Error(error.message);
  }
  await deleteRun(runId);
}

export async function fetchDefaultAudience(): Promise<Audience> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'everyone';
  const { data } = await supabase.from('profiles').select('default_activity_visibility').eq('id', user.id).maybeSingle();
  return (data?.default_activity_visibility as Audience | null) ?? 'everyone';
}

export async function saveDefaultAudience(a: Audience): Promise<void> {
  const { error } = await supabase.rpc('set_default_activity_visibility', { p_visibility: a });
  if (error) throw new Error(error.message);
}

// ── Photos (20261113000001) ─────────────────────────────────────────────────
export const MAX_PHOTOS = 6;
const BUCKET = 'feed';

/** A photo in the edit sheet: saved ones have a storage path, new ones only a local uri. */
export interface ActivityPhoto { path?: string; uri: string }

export const photoUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

async function uploadPhoto(userId: string, runId: string, uri: string): Promise<string> {
  const ext = (uri.split('?')[0].split('.').pop() ?? 'jpg').toLowerCase();
  const type = ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg';
  const name = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${type === 'jpeg' ? 'jpg' : type}`;
  const path = `${userId}/${runId}/${name}`;
  const body = await fetch(uri).then(r => r.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: `image/${type}` });
  if (error) throw new Error(error.message);
  return path;
}

/** Uploads new photos, saves the list, then removes photos that were taken out. */
async function savePhotos(runId: string, before: string[], photos: ActivityPhoto[]): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const paths: string[] = [];
  for (const p of photos.slice(0, MAX_PHOTOS)) paths.push(p.path ?? await uploadPhoto(user.id, runId, p.uri));
  const { data, error } = await supabase.rpc('set_activity_photos', { p_run_id: runId, p_paths: paths });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error('not_synced');
  const removed = before.filter(p => !paths.includes(p));
  if (removed.length) supabase.storage.from(BUCKET).remove(removed).catch(() => {});
  return paths;
}

/** Ask for a flagged activity to be reviewed (20261113000003). */
export async function appealFlag(runId: string, note: string): Promise<void> {
  const { data, error } = await supabase.rpc('appeal_run_flag', { p_run_id: runId, p_note: note });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error('not flagged');
  const local = await getRunById(runId);
  if (local) await saveRun({ ...local, integrityStatus: 'appealed' });
}
