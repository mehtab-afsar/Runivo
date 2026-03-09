import React from 'react';
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// ── framer-motion (no canvas in jsdom) ──────────────────────────────────────
vi.mock('framer-motion', () => {
  const create = (_: unknown, tag: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.forwardRef((props: any, ref: any) => React.createElement(tag, { ...props, ref }));
  const motion = new Proxy({} as Record<string, unknown>, {
    get: (_, tag: string) => create(_, tag),
  });
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useAnimation: () => ({ start: vi.fn() }),
    useMotionValue: (v: unknown) => ({ get: () => v, set: vi.fn() }),
  };
});

// ── maplibre-gl ──────────────────────────────────────────────────────────────
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      remove: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      fitBounds: vi.fn(),
      flyTo: vi.fn(),
      getSource: vi.fn(),
      isStyleLoaded: vi.fn(() => true),
    })),
    Marker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
  },
}));

// ── haptics & audio ──────────────────────────────────────────────────────────
vi.mock('@shared/lib/haptics', () => ({ haptic: vi.fn() }));
vi.mock('@shared/audio/sounds', () => ({
  soundManager: { play: vi.fn(), isEnabled: vi.fn(() => true), setEnabled: vi.fn() },
}));

// ── navigator.geolocation ────────────────────────────────────────────────────
Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  },
  configurable: true,
});
