const AVATAR_COLORS = [
  '#2C3E7A', '#7A2C4E', '#2C7A4E', '#7A5C2C',
  '#4E2C7A', '#2C6B7A', '#7A2C2C', '#2C7A6B',
  '#6B2C7A', '#2C4E7A',
];

/** Returns a deterministic background color for an avatar based on the user's name. */
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
