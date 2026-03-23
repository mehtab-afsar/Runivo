/**
 * h3-js shim for Hermes / React Native.
 *
 * h3-js (Emscripten WASM) calls `new TextDecoder("utf-16le")` at module-load
 * time. Hermes does not support the utf-16le encoding, so this crashes.
 *
 * We install the `text-encoding` polyfill (which does support utf-16le) before
 * loading the real h3-js, then re-export everything unchanged.
 *
 * Metro redirects `require('h3-js')` here via extraNodeModules.
 * The real h3-js is required via a relative path so it bypasses the alias and
 * loads the actual package from node_modules.
 */

// Install polyfill before h3-js runs its module-level TextDecoder call
var enc = require('text-encoding');
global.TextDecoder = enc.TextDecoder;
global.TextEncoder = enc.TextEncoder;

// Relative path from apps/mobile/shims/ → root/node_modules/h3-js
// This bypasses Metro's extraNodeModules alias to avoid infinite recursion.
module.exports = require('../../../node_modules/h3-js');
