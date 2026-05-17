export const TIER_CONFIG: Record<string, { bg: string; fg: string; label: string }> = {
  patch:    { bg: '#EAF3DE', fg: '#3B6D11', label: 'PATCH'    },
  block:    { bg: '#E6F1FB', fg: '#185FA5', label: 'BLOCK'    },
  district: { bg: '#FAEEDA', fg: '#854F0B', label: 'DISTRICT' },
  quarter:  { bg: '#EEEDFE', fg: '#3C3489', label: 'QUARTER'  },
  domain:   { bg: '#FCEBEB', fg: '#A32D2D', label: 'DOMAIN'   },
};

export const RANK_COLORS: Record<string, { bg: string; fg: string }> = {
  pacer:    { bg: '#F1EFE8', fg: '#5F5E5A' },
  strider:  { bg: '#E6F1FB', fg: '#185FA5' },
  chaser:   { bg: '#EEEDFE', fg: '#3C3489' },
  hunter:   { bg: '#FAEEDA', fg: '#854F0B' },
  sovereign:{ bg: '#FCEBEB', fg: '#A32D2D' },
};

export function formatArea(m2: number): string {
  if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)} km²`;
  if (m2 >= 10_000)    return `${Math.round(m2 / 1_000)}k m²`;
  return `${Math.round(m2).toLocaleString()} m²`;
}
