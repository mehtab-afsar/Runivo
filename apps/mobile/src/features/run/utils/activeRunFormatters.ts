// Pure formatting helpers for the live run screen.

export function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function fmtPaceSecs(secPerUnit: number): string {
  if (!Number.isFinite(secPerUnit) || secPerUnit <= 0 || secPerUnit > 60 * 30) return '–:––';
  const m = Math.floor(secPerUnit / 60);
  const sec = Math.round(secPerUnit % 60);
  return sec === 60 ? `${m + 1}:00` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function fmtArea(m2: number): string {
  return m2 >= 100_000 ? `${(m2 / 1_000_000).toFixed(2)} km²` : `${Math.round(m2).toLocaleString()} m²`;
}
