/**
 * Renders SVG markup off screen and exports it as a PNG (base64), using
 * react-native-svg's native toDataURL — no extra native module. Used for the
 * run share card: Instagram, WhatsApp and iMessage reject SVG files.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

export interface PngCaptureHandle {
  /** Resolves with base64 PNG data (no data: prefix). */
  capture(xml: string, opts: { viewWidth: number; viewHeight: number; outWidth: number; outHeight: number }): Promise<string>;
}

interface Job {
  xml: string; n: number;
  viewWidth: number; viewHeight: number; outWidth: number; outHeight: number;
  resolve: (b64: string) => void; reject: (e: Error) => void;
}

type SvgWithExport = { toDataURL?: (cb: (b64: string) => void, o?: object) => void };

export const PngCapture = forwardRef<PngCaptureHandle>(function PngCapture(_props, ref) {
  const [job, setJob] = useState<Job | null>(null);
  const svgRef = useRef<SvgWithExport | null>(null);
  const counter = useRef(0);

  useImperativeHandle(ref, () => ({
    capture: (xml, o) => new Promise<string>((resolve, reject) => {
      counter.current += 1;
      setJob({ xml, n: counter.current, ...o, resolve, reject });
    }),
  }), []);

  useEffect(() => {
    if (!job) return;
    let done = false;
    const finish = (fn: () => void) => { if (!done) { done = true; fn(); setJob(null); } };
    // Give the native view a frame or two to draw before exporting it.
    const start = setTimeout(() => {
      const svg = svgRef.current;
      if (!svg?.toDataURL) { finish(() => job.reject(new Error('SVG export unavailable'))); return; }
      svg.toDataURL(b64 => finish(() => job.resolve(b64)), { width: job.outWidth, height: job.outHeight });
    }, 150);
    const timeout = setTimeout(() => finish(() => job.reject(new Error('SVG export timed out'))), 5000);
    return () => { clearTimeout(start); clearTimeout(timeout); };
  }, [job]);

  if (!job) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0, width: job.viewWidth, height: job.viewHeight }}>
      <SvgXml key={job.n} xml={job.xml} override={{ ref: svgRef, width: job.viewWidth, height: job.viewHeight }} />
    </View>
  );
});
