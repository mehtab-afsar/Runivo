import { describe, it, expect } from 'vitest';
import { qrMatrix, qrPath } from './qrCode';

// Reference matrices were checked against python-qrcode (all 8 masks) and decoded with zxing.
describe('qrMatrix', () => {
  it('picks the smallest version: 21 modules for short text, 37 for a profile link', () => {
    expect(qrMatrix('hi').length).toBe(21);
    expect(qrMatrix('https://runivo.app/r/8e2f1c3a-4b5d-4e6f-9a0b-1c2d3e4f5a6b?u=mehtab').length).toBe(37);
  });

  it('draws the three finder patterns', () => {
    const m = qrMatrix('runivo');
    const n = m.length;
    for (const [x0, y0] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      expect(m[y0][x0]).toBe(true);
      expect(m[y0 + 1][x0 + 1]).toBe(false);
      expect(m[y0 + 3][x0 + 3]).toBe(true);
    }
  });

  it('matches python-qrcode for "hi", mask 0', () => {
    const rows = qrMatrix('hi', 0).map(r => r.map(b => (b ? 1 : 0)).join(''));
    expect(rows).toEqual([
      '111111100001101111111',
      '100000101111001000001',
      '101110100011101011101',
      '101110100101001011101',
      '101110101111101011101',
      '100000100101001000001',
      '111111101010101111111',
      '000000000010000000000',
      '101010100110100010010',
      '101100000011010101111',
      '000010111011011101111',
      '001011010101110111010',
      '110100101111011100100',
      '000000001000001000111',
      '111111100100100010011',
      '100000100110001000111',
      '101110101110101010101',
      '101110100111010101010',
      '101110101111011101101',
      '100000100111110111010',
      '111111101101011101111',
    ]);
  });

  it('refuses text longer than version 10 holds', () => {
    expect(() => qrMatrix('x'.repeat(300))).toThrow();
  });

  it('turns rows into one path', () => {
    expect(qrPath([[true, true, false], [false, true, false]])).toBe('M0 0h2v1h-2zM1 1h1v1h-1z');
  });
});
