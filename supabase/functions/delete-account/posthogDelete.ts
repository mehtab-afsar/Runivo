// Pure helper (fetch only, no Deno APIs) so vitest can cover it.
//
// Deleting an account removes our database rows, but product analytics events
// recorded under the runner's account id live at PostHog. The privacy policy
// says they are deleted with the account, so this asks PostHog to delete the
// person and their events (bulk_delete with delete_events). It needs a PostHog
// *personal* API key (not the public project key the app uses) with write
// access to persons; without the secrets it skips cleanly and the function
// logs that it did.

export interface PostHogDeleteConfig {
  host: string;        // https://us.posthog.com (the app host, not the ingestion host)
  projectId: string;
  personalApiKey: string;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) =>
  Promise<{ ok: boolean; status: number }>;

export async function deletePostHogPerson(
  cfg: PostHogDeleteConfig,
  distinctId: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<boolean> {
  const url = `${cfg.host.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(cfg.projectId)}/persons/bulk_delete/`;
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.personalApiKey}` },
    body: JSON.stringify({ distinct_ids: [distinctId], delete_events: true }),
  });
  return res.ok;
}

export function posthogConfigFromEnv(get: (k: string) => string | undefined): PostHogDeleteConfig | null {
  const projectId = get('POSTHOG_PROJECT_ID');
  const personalApiKey = get('POSTHOG_PERSONAL_API_KEY');
  return projectId && personalApiKey
    ? { host: get('POSTHOG_APP_HOST') ?? 'https://us.posthog.com', projectId, personalApiKey }
    : null;
}
