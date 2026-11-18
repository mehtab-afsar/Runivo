/** The fixed cheer messages. Must match public.cheer_text() (20261115000025). */
export type CheerKey = 'go' | 'pace' | 'home' | 'zone' | 'clap';

export const CHEERS: { key: CheerKey; label: (name: string) => string }[] = [
  { key: 'go',   label: n => `Go ${n || 'you'}!` },
  { key: 'pace', label: () => 'Keep that pace' },
  { key: 'home', label: () => 'Bring it home' },
  { key: 'zone', label: () => 'Take that zone' },
  { key: 'clap', label: () => 'Clap clap!' },
];

/** The words a cheer says. Matches public.cheer_text() on the server. */
export function cheerText(key: string, runnerName: string): string {
  return (CHEERS.find(c => c.key === key) ?? CHEERS[4]).label(runnerName);
}
