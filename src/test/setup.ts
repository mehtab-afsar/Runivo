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
    // Regular function so `new Map()` works correctly in Vitest v4
    Map: vi.fn(function () {
      return {
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        remove: vi.fn(),
        resize: vi.fn(),
        addSource: vi.fn(),
        addLayer: vi.fn(),
        removeLayer: vi.fn(),
        removeSource: vi.fn(),
        fitBounds: vi.fn(),
        flyTo: vi.fn(),
        easeTo: vi.fn(),
        jumpTo: vi.fn(),
        getCenter: vi.fn(() => ({ lng: 77.209, lat: 28.613 })),
        getZoom: vi.fn(() => 15),
        getBounds: vi.fn(() => ({ contains: vi.fn(() => false) })),
        setStyle: vi.fn(),
        getSource: vi.fn(() => ({ setData: vi.fn() })),
        isStyleLoaded: vi.fn(() => true),
        objectStoreNames: [],
      };
    }),
    Marker: vi.fn(function () {
      return {
        setLngLat: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(),
        getElement: vi.fn(() => ({
          parentElement: null,
          querySelector: vi.fn(() => null),
        })),
      };
    }),
  },
}));

// ── haptics & audio ──────────────────────────────────────────────────────────
vi.mock('@shared/lib/haptics', () => ({ haptic: vi.fn() }));
vi.mock('@shared/audio/sounds', () => ({
  soundManager: { play: vi.fn(), isEnabled: vi.fn(() => true), setEnabled: vi.fn() },
}));

// ── ResizeObserver (not in jsdom) ────────────────────────────────────────────
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ── navigator.geolocation ────────────────────────────────────────────────────
Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  },
  configurable: true,
});
