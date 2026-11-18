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

// 0c. Dev only: hide known simulator-only noise. Unsigned simulator builds have no
//     Keychain entitlement, so expo-notifications and the session key store log
//     errors that never happen on a signed build.
if (__DEV__) {
  require('react-native').LogBox.ignoreLogs([
    '[expo-notifications] Error reading persisted server registration info',
    '[session] could not use the secure key store',
  ]);
}

// 1. Buffer polyfill — must be absolute first so expo-sqlite can encode utf-16le
(global as any).Buffer = require('buffer').Buffer;

// 2. URL polyfill
require('react-native-url-polyfill/auto');

// 2b. window.location polyfill — Supabase JS v2 accesses window.location in some
//     auth code paths (e.g. PKCE flow error recovery). React Native polyfills
//     `window` as `global` but leaves `window.location` undefined, causing a
//     TypeError. Provide a no-op stub so those paths don't crash.
if (typeof (global as any).window !== 'undefined' && !(global as any).window.location) {
  (global as any).window.location = {
    href:     '',
    origin:   '',
    pathname: '',
    search:   '',
    hash:     '',
    reload:   () => {},
    assign:   () => {},
    replace:  () => {},
  };
}

// 3. Register app
const { registerRootComponent } = require('expo');
const App = require('./App').default;
registerRootComponent(App);
