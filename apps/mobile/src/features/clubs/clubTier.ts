/**
 * Club tier derived from cumulative distance.
 *
 * Lifted out of ClubScreen.tsx so the club card, the ranking row and the club
 * detail header all read the same ladder — it was previously defined inline in
 * the screen, which meant any new surface either re-derived it or drifted.
 *
 * Colours are deliberately fixed (not theme tokens): these chips sit on the
 * fixed-dark club card in both light and dark mode, so they must not invert.
 */
export interface ClubTier {
  bg: string;
  fg: string;
  label: string;
  minKm: number;
}

export const CLUB_TIERS: ClubTier[] = [
  { bg: '#F1EFE8', fg: '#5F5E5A', label: 'Local',    minKm: 0    },
  { bg: '#E6F1FB', fg: '#185FA5', label: 'Active',   minKm: 100  },
  { bg: '#EEEDFE', fg: '#3C3489', label: 'Regional', minKm: 500  },
  { bg: '#FAEEDA', fg: '#854F0B', label: 'Pro',      minKm: 1000 },
  { bg: '#FCEBEB', fg: '#A32D2D', label: 'Elite',    minKm: 5000 },
];

export function getClubTier(km: number): ClubTier {
  return [...CLUB_TIERS].reverse().find(t => km >= t.minKm) ?? CLUB_TIERS[0];
}
