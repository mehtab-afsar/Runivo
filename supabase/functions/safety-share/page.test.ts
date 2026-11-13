import { describe, it, expect } from 'vitest';
import { renderPage, statusLine, type ShareView } from './page';

const v: ShareView = { username: 'ana<script>', sport: 'run', status: 'live', lat: 12.97, lng: 77.59, position_at: new Date().toISOString(), distance_m: 3200, elapsed_sec: 1100 };

describe('safety share page', () => {
  it('escapes the name everywhere and never lets it close a script tag', () => {
    const html = renderPage(v, 'https://x/safety-share?t=a&json=1');
    expect(html).not.toContain('ana<script>');
    expect(html).toContain('ana&lt;script&gt;');
    expect(html).toContain('\\u003cscript');
  });
  it('says what is happening', () => {
    expect(statusLine(v)).toBe('ana<script> is running now.');
    expect(statusLine({ ...v, status: 'finished' })).toContain('has finished');
    expect(statusLine({ ...v, status: 'no_signal', sport: 'cycle' })).toContain('riding');
  });
  it('shows an expired page without a map for unknown links', () => {
    const html = renderPage(null, '');
    expect(html).toContain('expired');
    expect(html).not.toContain('leaflet.js');
  });
});
