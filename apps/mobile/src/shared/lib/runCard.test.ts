import { describe, it, expect } from 'vitest';
import { buildRunCardSvg, routePath } from './runCard';

const route = Array.from({ length: 20 }, (_, i) => ({ lat: 12.9 + i * 0.0003, lng: 77.6 + (i % 5) * 0.0002 }));
const base = { name: 'Test <Runner>', sub: 'Evening run · 18 Nov', title: 'Lake loop', stats: [{ value: '1.07', label: 'km' }, { value: '4:31', label: 'pace /km' }, { value: '4:51', label: 'time' }], route };

describe('run card', () => {
  it('fits the route inside its box', () => {
    const r = routePath(route, 50, 230, 300, 250)!;
    const nums = r.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      expect(nums[i]).toBeGreaterThanOrEqual(50); expect(nums[i]).toBeLessThanOrEqual(350);
      expect(nums[i + 1]).toBeGreaterThanOrEqual(230); expect(nums[i + 1]).toBeLessThanOrEqual(480);
    }
  });

  it('escapes text and shows the stats', () => {
    const svg = buildRunCardSvg(base);
    expect(svg).toContain('Test &lt;Runner&gt;');
    expect(svg).toContain('>4:31<');
    expect(svg).not.toContain('zone');
  });

  it('adds the zones chip only when zones were claimed', () => {
    expect(buildRunCardSvg({ ...base, zones: 2 })).toContain('+2 zones claimed');
    expect(buildRunCardSvg({ ...base, zones: 1 })).toContain('+1 zone claimed');
  });

  it('draws a placeholder when there is no route', () => {
    expect(routePath([], 0, 0, 10, 10)).toBeNull();
    expect(buildRunCardSvg({ ...base, route: [] })).toContain('stroke-opacity="0.25"');
  });
});
