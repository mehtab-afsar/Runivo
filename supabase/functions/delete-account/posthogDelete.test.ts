import { describe, expect, it } from 'vitest';
import { deletePostHogPerson, posthogConfigFromEnv, type FetchLike } from './posthogDelete';

const cfg = { host: 'https://us.posthog.com/', projectId: '123', personalApiKey: 'phx_secret' };

describe('deletePostHogPerson', () => {
  it('asks PostHog to delete the person and their events', async () => {
    let seen: { url: string; init: Parameters<FetchLike>[1] } | null = null;
    const fetchFn: FetchLike = async (url, init) => { seen = { url, init }; return { ok: true, status: 200 }; };
    expect(await deletePostHogPerson(cfg, 'user-1', fetchFn)).toBe(true);
    expect(seen!.url).toBe('https://us.posthog.com/api/projects/123/persons/bulk_delete/');
    expect(seen!.init.headers.Authorization).toBe('Bearer phx_secret');
    expect(JSON.parse(seen!.init.body)).toEqual({ distinct_ids: ['user-1'], delete_events: true });
  });

  it('reports failure when PostHog refuses', async () => {
    expect(await deletePostHogPerson(cfg, 'u', async () => ({ ok: false, status: 403 }))).toBe(false);
  });
});

describe('posthogConfigFromEnv', () => {
  it('needs both the project id and a personal key', () => {
    expect(posthogConfigFromEnv(() => undefined)).toBeNull();
    expect(posthogConfigFromEnv(k => ({ POSTHOG_PROJECT_ID: '1' } as Record<string, string>)[k])).toBeNull();
    expect(posthogConfigFromEnv(k => ({ POSTHOG_PROJECT_ID: '1', POSTHOG_PERSONAL_API_KEY: 'k' } as Record<string, string>)[k]))
      .toEqual({ host: 'https://us.posthog.com', projectId: '1', personalApiKey: 'k' });
  });
});
