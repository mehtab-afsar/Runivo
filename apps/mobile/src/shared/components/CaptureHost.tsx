/**
 * One off-screen SVG renderer for the whole app, mounted once at the root, so
 * any screen (a feed post, a run summary) can turn a card into a PNG and share
 * it without carrying its own renderer.
 */
import React, { useEffect, useRef } from 'react';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { PngCapture, type PngCaptureHandle } from '@features/run/components/PngCapture';

let host: PngCaptureHandle | null = null;

export function CaptureHost() {
  const ref = useRef<PngCaptureHandle>(null);
  useEffect(() => { host = ref.current; return () => { host = null; }; }, []);
  return <PngCapture ref={ref} />;
}

/** Renders the SVG to a PNG file in the cache and returns its path. */
export async function svgToPngFile(xml: string, size: { w: number; h: number; outW: number }, fileName: string): Promise<string> {
  if (!host) throw new Error('capture host not mounted');
  const outH = Math.round((size.outW * size.h) / size.w);
  const b64 = await host.capture(xml, { viewWidth: size.w, viewHeight: size.h, outWidth: size.outW, outHeight: outH });
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

/** Shares the SVG as a PNG through the iPhone share sheet. Throws when it can't, so callers can fall back. */
export async function shareSvgAsImage(xml: string, size: { w: number; h: number; outW: number }, fileName: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable');
  const uri = await svgToPngFile(xml, size, fileName);
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
}
