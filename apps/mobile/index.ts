// All require() — no import statements so nothing gets hoisted by Babel.
/* eslint-disable @typescript-eslint/no-require-imports */

// 0. Crypto polyfill — must be first; Supabase uses crypto.getRandomValues()
//    which Hermes doesn't provide natively.
require('react-native-get-random-values');

// 0b. crypto.randomUUID polyfill — Hermes has getRandomValues (from above)
//     but not randomUUID. Implement it per RFC 4122 §4.4.
if (typeof (global as any).crypto?.randomUUID !== 'function') {
  const cr = (global as any).crypto;
  if (cr) {
    cr.randomUUID = function (): string {
      const b = cr.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40; // version 4
      b[8] = (b[8] & 0x3f) | 0x80; // variant bits
      const h = Array.from(b as Uint8Array).map((x: number) => x.toString(16).padStart(2, '0'));
      return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10).join('')}`;
    };
  }
}

// 1. Buffer polyfill — must be absolute first so expo-sqlite can encode utf-16le
(global as any).Buffer = require('buffer').Buffer;

// 2. URL polyfill
require('react-native-url-polyfill/auto');

// 3. TextDecoder / TextEncoder polyfill
// Always override — Hermes has a native TextDecoder but it doesn't support
// utf-16le which h3-js requires at module load time.
const { TextDecoder, TextEncoder } = require('text-encoding');
(global as any).TextDecoder = TextDecoder;
(global as any).TextEncoder = TextEncoder;

// 4. Register app
const { registerRootComponent } = require('expo');
const App = require('./App').default;
registerRootComponent(App);
