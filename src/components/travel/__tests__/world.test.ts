/// <reference types="jest" />

import { project, routeCurve, WORLD } from '@/components/travel/world';

jest.mock('@/components/travel/data/world.json', () => ({
  meta: { unitsPerDegree: 20, top: 84, bottom: -58, width: 7200, height: 2840 },
  countries: [],
}));

const seoul = { latitude: 37.57, longitude: 126.98 };
const vancouver = { latitude: 49.26, longitude: -123.11 };
const busan = { latitude: 35.18, longitude: 129.08 };

describe('routeCurve', () => {
  it('starts and ends at the projected cities when the short way stays on the map', () => {
    const curve = routeCurve(seoul, busan, 0.1);
    const a = project(seoul.latitude, seoul.longitude);
    const b = project(busan.latitude, busan.longitude);
    expect([curve.x1, curve.y1, curve.x2, curve.y2]).toEqual([a.x, a.y, b.x, b.y]);
  });

  it('crosses the Pacific rather than the whole map', () => {
    const curve = routeCurve(seoul, vancouver, 0.2);
    const b = project(vancouver.latitude, vancouver.longitude);
    expect(curve.x2).toBeCloseTo(b.x + WORLD.meta.width);
    expect(curve.x2 - curve.x1).toBeLessThan(WORLD.meta.width / 2);
  });

  it('bows north of the straight line', () => {
    for (const [from, to] of [
      [seoul, busan],
      [busan, seoul],
      [seoul, vancouver],
      [vancouver, seoul],
    ]) {
      const curve = routeCurve(from, to, 0.2);
      expect(curve.cy).toBeLessThan((curve.y1 + curve.y2) / 2);
    }
  });
});
