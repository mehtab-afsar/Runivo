import { describe, it, expect } from 'vitest';
import { CHEERS, cheerText } from './cheerMessages';

describe('cheer messages', () => {
  it('say the same words as public.cheer_text() on the server', () => {
    expect(cheerText('go', 'kabir')).toBe('Go kabir!');
    expect(cheerText('pace', 'kabir')).toBe('Keep that pace');
    expect(cheerText('home', 'kabir')).toBe('Bring it home');
    expect(cheerText('zone', 'kabir')).toBe('Take that zone');
    expect(cheerText('clap', 'kabir')).toBe('Clap clap!');
  });

  it('fall back gracefully', () => {
    expect(cheerText('go', '')).toBe('Go you!');
    expect(cheerText('nonsense', 'kabir')).toBe('Clap clap!');
  });

  it('are exactly the keys the server accepts', () => {
    expect(CHEERS.map(c => c.key).sort()).toEqual(['clap', 'go', 'home', 'pace', 'zone']);
  });
});
