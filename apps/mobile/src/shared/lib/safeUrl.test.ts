import { describe, expect, it } from 'vitest';
import { safeHttpUrl } from './safeUrl';

describe('safeHttpUrl', () => {
  it('passes http and https links', () => {
    expect(safeHttpUrl('https://runivo.in/e/1')).toBe('https://runivo.in/e/1');
    expect(safeHttpUrl('  http://example.org  ')).toBe('http://example.org/');
  });

  it('rejects other schemes', () => {
    for (const bad of ['javascript:alert(1)', 'tel:+15551234567', 'sms:123', 'intent://x#Intent;end', 'runivo://auth/magic?code=x', 'file:///etc/passwd', 'data:text/html,hi']) {
      expect(safeHttpUrl(bad)).toBeNull();
    }
  });

  it('rejects empty and unparseable input', () => {
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl('')).toBeNull();
    expect(safeHttpUrl('not a url')).toBeNull();
  });
});
