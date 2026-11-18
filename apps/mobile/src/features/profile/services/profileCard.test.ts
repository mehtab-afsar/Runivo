import { describe, it, expect } from 'vitest';
import { profileLink, runnerIdFromLink, buildProfileCardSvg, buildProfileStorySvg } from './profileCard';

const ID = '8e2f1c3a-4b5d-4e6f-9a0b-1c2d3e4f5a6b';

describe('profile card', () => {
  it('builds the link with a safe username only', () => {
    expect(profileLink(ID, 'mehtab')).toBe(`https://runivo.app/r/${ID}?u=mehtab`);
    expect(profileLink(ID, 'a b<')).toBe(`https://runivo.app/r/${ID}`);
    expect(profileLink(ID)).toBe(`https://runivo.app/r/${ID}`);
  });

  it('reads a runner id back from scanned codes', () => {
    expect(runnerIdFromLink(profileLink(ID, 'mehtab'))).toBe(ID);
    expect(runnerIdFromLink(`runivo://runner/${ID.toUpperCase()}`)).toBe(ID);
    expect(runnerIdFromLink('https://evil.example/r/' + ID)).toBeNull();
    expect(runnerIdFromLink('hello')).toBeNull();
  });

  it('escapes names in the SVG', () => {
    const svg = buildProfileCardSvg({ name: 'A <b> & "c"', rank: 'Pacer', runs: 1, km: 3.2, zones: 0, link: profileLink(ID) });
    expect(svg).toContain('A &lt;b&gt; &amp; &quot;c&quot;');
    expect(svg).toContain('1</text>');
    expect(svg).toContain('>run<');
  });

  it('draws the photo when there is one, initials otherwise', () => {
    const base = { name: 'Mehtab Afsar', rank: 'Strider', runs: 12, km: 48.6, zones: 7, link: profileLink(ID) };
    expect(buildProfileStorySvg(base)).toContain('>MA</text>');
    expect(buildProfileStorySvg({ ...base, photo: 'data:image/jpeg;base64,AAAA' })).toContain('href="data:image/jpeg;base64,AAAA"');
  });
});
