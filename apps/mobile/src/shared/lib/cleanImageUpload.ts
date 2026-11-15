import { stripImageMetadata } from './stripImageMetadata';

/**
 * Reads a picked photo and removes its hidden metadata (GPS, camera, time)
 * before upload. The content type comes from the bytes, not the file name.
 * Throws for formats that can't be cleaned, so nothing leaves the phone with
 * its location still inside.
 */
export async function readCleanImage(uri: string): Promise<{ body: ArrayBuffer; contentType: string; ext: 'jpg' | 'png' | 'webp' }> {
  const buf: ArrayBuffer = await fetch(uri).then(r => r.arrayBuffer());
  const raw = new Uint8Array(buf);
  const clean = stripImageMetadata(raw);
  if (!clean) throw new Error('unsupported_image');
  const body = clean.bytes.buffer.slice(clean.bytes.byteOffset, clean.bytes.byteOffset + clean.bytes.byteLength) as ArrayBuffer;
  return { body, contentType: `image/${clean.type}`, ext: clean.type === 'jpeg' ? 'jpg' : clean.type };
}
