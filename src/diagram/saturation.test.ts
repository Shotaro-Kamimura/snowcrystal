import { describe, it, expect } from 'vitest';
import { waterSaturationExcessDensity } from './saturation';

describe('waterSaturationExcessDensity (Murphy & Koop 2005)', () => {
  it('b. 文献アンカー値と一致する [g/m³]', () => {
    const anchors: Array<[tempC: number, expected: number, tol: number]> = [
      [-10, 0.215, 0.02],
      [-15, 0.215, 0.02],
      [-20, 0.19, 0.02],
      [-30, 0.115, 0.015],
      [-40, 0.057, 0.01],
    ];
    for (const [tc, expected, tol] of anchors) {
      const actual = waterSaturationExcessDensity(tc);
      expect(Math.abs(actual - expected), `ρ_ws(${tc}) = ${actual}`).toBeLessThanOrEqual(tol);
    }
  });

  it('b. 極大が −11〜−16°C にある', () => {
    let bestT = 0;
    let bestV = -Infinity;
    for (let i = 0; i <= 400; i++) {
      const tc = -i / 10;
      const v = waterSaturationExcessDensity(tc);
      if (v > bestV) {
        bestV = v;
        bestT = tc;
      }
    }
    expect(bestT).toBeLessThanOrEqual(-11);
    expect(bestT).toBeGreaterThanOrEqual(-16);
  });
});
