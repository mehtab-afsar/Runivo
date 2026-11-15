/**
 * Links that come from other users or from the database (event registration
 * pages, partner sites) are opened in the browser. Only plain http(s) is safe
 * to hand to Linking.openURL: anything else can launch another app
 * (`tel:`, `sms:`, custom schemes, `intent:`) or run script (`javascript:`).
 */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}
