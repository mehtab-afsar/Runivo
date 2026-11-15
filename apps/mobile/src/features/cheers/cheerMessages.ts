/** The fixed cheer messages. Must match public.cheer_text() (20261115000025). */
export type CheerKey = 'go' | 'pace' | 'home' | 'zone' | 'clap';

export const CHEERS: { key: CheerKey; emoji: string; label: (name: string) => string }[] = [
  { key: 'go',   emoji: '👏', label: n => `Go ${n || 'you'}!` },
  { key: 'pace', emoji: '🔥', label: () => 'Keep that pace' },
  { key: 'home', emoji: '🏁', label: () => 'Bring it home' },
  { key: 'zone', emoji: '⬢',  label: () => 'Take that zone' },
  { key: 'clap', emoji: '🙌', label: () => 'Clap clap!' },
];

/** The words a cheer says. Matches public.cheer_text() on the server. */
export function cheerText(key: string, runnerName: string): string {
  return (CHEERS.find(c => c.key === key) ?? CHEERS[4]).label(runnerName);
}
