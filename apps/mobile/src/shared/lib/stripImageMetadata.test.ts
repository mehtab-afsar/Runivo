import { describe, it, expect } from 'vitest';
import { stripImageMetadata, exifOrientation } from './stripImageMetadata';

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap(p => (typeof p === 'string' ? [...p].map(c => c.charCodeAt(0)) : p)));
const seg = (marker: number, payload: Uint8Array) =>
  new Uint8Array([0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload]);
const has = (hay: Uint8Array, needle: string) => Buffer.from(hay).includes(Buffer.from(needle, 'latin1'));

/** EXIF with Orientation and a fake GPS block whose text we can look for. */
function exifPayload(orientation: number, bigEndian = false): Uint8Array {
  const u16 = (v: number) => (bigEndian ? [v >> 8, v & 0xff] : [v & 0xff, v >> 8]);
  const u32 = (v: number) => (bigEndian ? [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff] : [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24]);
  return bytes('Exif\0\0', bigEndian ? 'MM' : 'II', u16(42), u32(8),
    u16(2),
    u16(0x0112), u16(3), u32(1), [...u16(orientation), 0, 0],
    u16(0x8825), u16(4), u32(1), u32(38), // GPS IFD pointer
    u32(0),
    'GPS 51.5007N 0.1246W HOME', 'Model iPhone SN123');
}

const SCAN = bytes([0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6], [9, 8, 7, 0xff, 0x00, 6], [0xff, 0xd9]);

function jpeg(...segments: Uint8Array[]): Uint8Array {
  return new Uint8Array([0xff, 0xd8, ...segments.flatMap(s => [...s]), ...SCAN]);
}

describe('stripping photo metadata', () => {
  it('removes GPS, camera and XMP data from a JPEG but keeps the picture intact', () => {
    const app0 = seg(0xe0, bytes('JFIF\0', [1, 1, 0, 0, 1, 0, 1, 0, 0]));
    const icc = seg(0xe2, bytes('ICC_PROFILE\0', [1, 1, 42]));
    const xmp = seg(0xe1, bytes('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta exif:GPSLatitude="51.5"/>'));
    const iptc = seg(0xed, bytes('Photoshop 3.0\0 City London'));
    const comment = seg(0xfe, bytes('taken at home'));
    const out = stripImageMetadata(jpeg(app0, seg(0xe1, exifPayload(1)), xmp, icc, iptc, comment));
    expect(out?.type).toBe('jpeg');
    for (const leak of ['GPS', 'HOME', 'SN123', 'GPSLatitude', 'London', 'taken at home']) expect(has(out!.bytes, leak)).toBe(false);
    expect(has(out!.bytes, 'JFIF')).toBe(true);
    expect(has(out!.bytes, 'ICC_PROFILE')).toBe(true);
    expect(Buffer.from(out!.bytes).subarray(-SCAN.length)).toEqual(Buffer.from(SCAN));
  });

  it('keeps the rotation, so a portrait photo is not shown sideways', () => {
    for (const bigEndian of [false, true]) {
      const out = stripImageMetadata(jpeg(seg(0xe1, exifPayload(6, bigEndian))))!;
      expect(has(out.bytes, 'GPS')).toBe(false);
      // The rebuilt EXIF sits right after SOI and holds only Orientation = 6.
      expect([out.bytes[2], out.bytes[3]]).toEqual([0xff, 0xe1]);
      expect(exifOrientation(out.bytes.subarray(6))).toBe(6);
    }
  });

  it('adds no EXIF at all when the photo is already upright', () => {
    const out = stripImageMetadata(jpeg(seg(0xe1, exifPayload(1))))!;
    expect(has(out.bytes, 'Exif')).toBe(false);
  });

  it('removes text and EXIF chunks from a PNG', () => {
    const chunk = (type: string, data: string) => bytes([0, 0, 0, data.length], type, data, [0, 0, 0, 0]);
    const png = new Uint8Array([
      ...bytes([0x89], 'PNG\r\n\x1a\n'), ...chunk('IHDR', '1234567890123'), ...chunk('eXIf', 'GPS home'),
      ...chunk('tEXt', 'Location\0London'), ...chunk('IDAT', 'pixels'), ...chunk('IEND', ''),
    ]);
    const out = stripImageMetadata(png)!;
    expect(out.type).toBe('png');
    expect(has(out.bytes, 'GPS')).toBe(false);
    expect(has(out.bytes, 'London')).toBe(false);
    expect(has(out.bytes, 'IHDR') && has(out.bytes, 'IDAT') && has(out.bytes, 'IEND')).toBe(true);
  });

  it('removes EXIF and XMP from a WebP and fixes the sizes and flags', () => {
    const le32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24];
    const chunk = (type: string, data: number[]) => [...bytes(type), ...le32(data.length), ...data, ...(data.length & 1 ? [0] : [])];
    const vp8x = chunk('VP8X', [0x0c, 0, 0, 0, 1, 0, 0, 1, 0, 0]);
    const body = [...bytes('WEBP'), ...vp8x, ...chunk('VP8 ', [1, 2, 3, 4]), ...chunk('EXIF', [...bytes('GPS here')]), ...chunk('XMP ', [...bytes('<xmp/>')])];
    const webp = new Uint8Array([...bytes('RIFF'), ...le32(body.length), ...body]);
    const out = stripImageMetadata(webp)!;
    expect(out.type).toBe('webp');
    expect(has(out.bytes, 'GPS')).toBe(false);
    expect(has(out.bytes, '<xmp')).toBe(false);
    const riff = out.bytes[4] | (out.bytes[5] << 8) | (out.bytes[6] << 16) | (out.bytes[7] << 24);
    expect(riff).toBe(out.bytes.length - 8);
    expect(out.bytes[20] & 0x0c).toBe(0); // VP8X flags byte
  });

  it('refuses formats it cannot clean (HEIC, unknown bytes)', () => {
    expect(stripImageMetadata(bytes([0, 0, 0, 0x18], 'ftypheic'))).toBeNull();
    expect(stripImageMetadata(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
