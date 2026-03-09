import { Page } from '@playwright/test';

/**
 * Intercepts the MapLibre GL bundle before it loads and substitutes a
 * no-op stub. This prevents WebGL crashes in headless Playwright.
 *
 * The stub emits a 'load' event so map.on('load', cb) callbacks still fire,
 * letting app code run normally (markers, layers, etc. are all no-ops).
 */
export async function mockMapLibre(page: Page) {
  // Intercept any URL that contains the maplibre bundle
  await page.route('**/maplibre-gl*', async (route) => {
    const url = route.request().url();
    // Only intercept JS bundles, not CSS
    if (!url.endsWith('.css') && !url.includes('.css?')) {
      await route.fulfill({
        contentType: 'application/javascript; charset=utf-8',
        body: buildMapLibreStub(),
      });
    } else {
      await route.continue();
    }
  });
}

function buildMapLibreStub(): string {
  return `
// ── MapLibre GL stub for Playwright E2E tests ─────────────────────────────
"use strict";

const NOOP = () => {};
const CHAIN = function() { return this; };

class FakeMap {
  constructor(opts) {
    this._loadCallbacks = [];
    this._el = typeof opts.container === 'string'
      ? document.getElementById(opts.container)
      : opts.container;
    // Fire 'load' asynchronously so React useEffect has time to subscribe
    setTimeout(() => {
      this._loadCallbacks.forEach(cb => {
        try { cb({}); } catch(e) {}
      });
    }, 80);
  }
  on(event, cb) {
    if (event === 'load') this._loadCallbacks.push(cb);
    return this;
  }
  off()   { return this; }
  once(event, cb) {
    setTimeout(() => { try { cb({}); } catch(e) {} }, 100);
    return this;
  }
  remove()           {}
  resize()           {}
  getCenter()        { return { lng: 77.209, lat: 28.6139, wrap: NOOP, toArray: () => [77.209, 28.6139] }; }
  getBounds()        { return { contains: () => false, getNorthEast: NOOP, getSouthWest: NOOP }; }
  getZoom()          { return 16; }
  setStyle()         { return this; }
  jumpTo()           { return this; }
  easeTo()           { return this; }
  flyTo()            { return this; }
  fitBounds()        { return this; }
  setCenter()        { return this; }
  setZoom()          { return this; }
  addSource()        { return this; }
  addLayer()         { return this; }
  removeLayer()      { return this; }
  removeSource()     { return this; }
  getSource()        { return { setData: NOOP }; }
  getLayer()         { return null; }
  queryRenderedFeatures() { return []; }
  setPaintProperty() { return this; }
  setLayoutProperty(){ return this; }
  isStyleLoaded()    { return true; }
  dragPan            = { enable: NOOP, disable: NOOP };
  scrollZoom         = { enable: NOOP, disable: NOOP };
  touchZoomRotate    = { enable: NOOP, disable: NOOP };
  doubleClickZoom    = { enable: NOOP, disable: NOOP };
  keyboard           = { enable: NOOP, disable: NOOP };
  boxZoom            = { enable: NOOP, disable: NOOP };
}

class FakeMarker {
  constructor(opts) {
    this._el = (opts && opts.element) || (() => {
      const d = document.createElement('div');
      return d;
    })();
  }
  setLngLat(ll) { return this; }
  getLngLat()   { return { lng: 77.209, lat: 28.6139, wrap: NOOP, toArray: () => [77.209, 28.6139] }; }
  addTo(map)    { return this; }
  remove()      {}
  getElement()  { return this._el; }
  setPopup()    { return this; }
  getPopup()    { return null; }
  togglePopup() { return this; }
}

class FakeNavigationControl { onAdd() { return document.createElement('div'); } onRemove() {} }
class FakeLngLat {
  constructor(lng, lat) { this.lng = lng; this.lat = lat; }
  wrap()    { return this; }
  toArray() { return [this.lng, this.lat]; }
  static convert(input) {
    if (Array.isArray(input)) return new FakeLngLat(input[0], input[1]);
    return new FakeLngLat(input.lng || 0, input.lat || 0);
  }
}

const maplibregl = {
  Map: FakeMap,
  Marker: FakeMarker,
  NavigationControl: FakeNavigationControl,
  LngLat: FakeLngLat,
  supported: () => true,
  version: '4.0.0',
};

// CommonJS + ESM exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = maplibregl;
  module.exports.default = maplibregl;
}

// ES module named exports for Vite's static import analysis
export { FakeMap as Map, FakeMarker as Marker, FakeNavigationControl as NavigationControl, FakeLngLat as LngLat };
export default maplibregl;
`;
}
