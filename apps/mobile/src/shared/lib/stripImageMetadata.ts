/**
 * Removes hidden metadata from a photo before it leaves the phone.
 *
 * Phone photos carry EXIF: GPS coordinates (often the runner's home), the
 * camera's serial number and the time taken. A run photo shared to the feed
 * must not carry those. This works on the encoded bytes, so it needs no native
 * image module and does not re-compress the picture.
 *
 *  - JPEG: drops every APP1 (EXIF, XMP), APP13 (IPTC) and comment segment, then
 *    writes back a minimal EXIF holding only the Orientation tag, so the photo
 *    is not shown sideways. Colour profiles (APP2) and JFIF (APP0) are kept.
 *  - PNG: drops eXIf, tEXt, iTXt and zTXt chunks.
 *  - WebP: drops the EXIF and XMP chunks and clears their flags in VP8X.
 *
 * Anything else returns null: the caller refuses to upload a format it cannot clean.
 */

export type CleanImage = { bytes: Uint8Array; type: 'jpeg' | 'png' | 'webp' };

export function stripImageMetadata(input: Uint8Array): CleanImage | null {
  if (input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) {
    return { bytes: stripJpeg(input), type: 'jpeg' };
  }
  if (input.length >= 8 && input[0] === 0x89 && input[1] === 0x50 && input[2] === 0x4e && input[3] === 0x47) {
    return { bytes: stripPng(input), type: 'png' };
  }
  if (input.length >= 12 && ascii(input, 0, 4) === 'RIFF' && ascii(input, 8, 4) === 'WEBP') {
    return { bytes: stripWebp(input), type: 'webp' };
  }
  return null;
}

function ascii(b: Uint8Array, at: number, len: number): string {
  let s = '';
  for (let i = 0; i < len && at + i < b.length; i++) s += String.fromCharCode(b[at + i]);
  return s;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ─── JPEG ─────────────────────────────────────────────────────────────────────

/** Orientation (1–8) from an EXIF APP1 payload starting at "Exif\0\0", or 1. */
export function exifOrientation(seg: Uint8Array): number {
  if (ascii(seg, 0, 6) !== 'Exif\0\0') return 1;
  const t = 6;
  const le = ascii(seg, t, 2) === 'II';
  const u16 = (o: number) => (le ? seg[o] | (seg[o + 1] << 8) : (seg[o] << 8) | seg[o + 1]);
  const u32 = (o: number) => (le
    ? (seg[o] | (seg[o + 1] << 8) | (seg[o + 2] << 16) | (seg[o + 3] << 24)) >>> 0
    : ((seg[o] << 24) | (seg[o + 1] << 16) | (seg[o + 2] << 8) | seg[o + 3]) >>> 0);
  if (seg.length < t + 8) return 1;
  const ifd = t + u32(t + 4);
  if (ifd + 2 > seg.length) return 1;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > seg.length) break;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

/** APP1 segment holding only an Orientation tag (little-endian TIFF). */
function orientationApp1(orientation: number): Uint8Array {
  const payload = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,       // "Exif\0\0"
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // "II", 42, IFD0 at 8
    0x01, 0x00,                               // one entry
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00, // Orientation SHORT
    0x00, 0x00, 0x00, 0x00,                   // no next IFD
  ];
  const len = payload.length + 2;
  return new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff, ...payload]);
}

function stripJpeg(b: Uint8Array): Uint8Array {
  const keep: Uint8Array[] = [b.subarray(0, 2)]; // SOI
  let orientation = 1;
  let i = 2;
  let insertAt = 1; // after SOI, or after APP0 if present
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) break; // malformed: keep the rest untouched below
    const marker = b[i + 1];
    if (marker === 0xff) { i += 1; continue; } // fill byte
    if (marker === 0xda) break; // start of scan: image data follows
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) break;
    const seg = b.subarray(i, i + 2 + len);
    const isApp1 = marker === 0xe1;
    const drop = isApp1 || marker === 0xed || marker === 0xfe || (marker >= 0xe3 && marker <= 0xef);
    if (isApp1) orientation = Math.max(orientation, exifOrientation(seg.subarray(4)));
    if (!drop) {
      keep.push(seg);
      if (marker === 0xe0) insertAt = keep.length;
    }
    i += 2 + len;
  }
  keep.push(b.subarray(i)); // scan data and everything after, byte for byte
  if (orientation !== 1) keep.splice(insertAt, 0, orientationApp1(orientation));
  return concat(keep);
}

// ─── PNG ──────────────────────────────────────────────────────────────────────

const PNG_DROP = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt']);

function stripPng(b: Uint8Array): Uint8Array {
  const keep: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) { keep.push(b.subarray(i)); return concat(keep); }
    if (!PNG_DROP.has(type)) keep.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return concat(keep);
}

// ─── WebP ─────────────────────────────────────────────────────────────────────

function stripWebp(b: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const size = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)) >>> 0;
    const end = Math.min(b.length, i + 8 + size + (size & 1));
    if (type !== 'EXIF' && type !== 'XMP ') {
      const c = b.slice(i, end);
      if (type === 'VP8X' && c.length > 8) c[8] &= ~(0x08 | 0x04); // clear EXIF and XMP flags
      chunks.push(c);
    }
    i = end;
  }
  const body = concat(chunks);
  const riffSize = body.length + 4;
  const head = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, riffSize & 0xff, (riffSize >> 8) & 0xff, (riffSize >> 16) & 0xff, (riffSize >>> 24) & 0xff,
    0x57, 0x45, 0x42, 0x50,
  ]);
  return concat([head, body]);
}
