/** The weekly digest email (N5): plain, short, one call to open the app. */
export interface DigestRow { username: string; km: number; runs: number; zones_claimed: number; zones_lost: number; fading: number; pace_earned: number }

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function digestSubject(r: DigestRow): string {
  if (r.zones_lost > 0) return `${r.zones_lost} of your zones were taken this week`;
  if (r.fading > 0) return `${r.fading} of your zones are fading`;
  return r.runs > 0 ? `Your week: ${r.km} km and ${r.zones_claimed} zones` : 'Your ground misses you';
}

export function digestHtml(r: DigestRow, appUrl: string, unsubscribeUrl: string): string {
  const line = (label: string, value: string) => `<tr><td style="padding:6px 0;color:#64636A">${label}</td><td style="padding:6px 0;text-align:right;font-weight:600">${value}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#F4F3F0;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#0C0C0D">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
<p style="font-size:13px;color:#64636A;margin:0 0 6px">Runivo · your week</p>
<h1 style="font-size:22px;margin:0 0 18px">Hi ${esc(r.username)}</h1>
<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:14px;padding:8px 16px;display:block">
${line('Distance', `${r.km} km`)}${line('Activities', String(r.runs))}${line('Zones claimed', String(r.zones_claimed))}${line('Zones lost', String(r.zones_lost))}${line('Fading now', String(r.fading))}${line('PACE earned', String(r.pace_earned))}
</table>
<p style="margin:22px 0"><a href="${appUrl}" style="background:#FF4518;color:#fff;text-decoration:none;padding:12px 22px;border-radius:24px;font-weight:600">${r.fading > 0 || r.zones_lost > 0 ? 'Defend your ground' : 'Open Runivo'}</a></p>
<p style="font-size:12px;color:#A3A1A8">You get this because push notifications are off. <a href="${unsubscribeUrl}" style="color:#A3A1A8">Stop these emails</a> in Settings → Notifications.</p>
</div></body></html>`;
}
