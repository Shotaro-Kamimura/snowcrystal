import { describe, it, expect } from 'vitest';
import { classifyOnDiagram } from './lookup';
import { waterSaturationExcessDensity } from './saturation';
import type { Morphology } from '../types';
import type { ConditionDiagram, DiagramRegion } from './types';

function region(id: string, morphology: Morphology): DiagramRegion {
  return {
    id,
    mlCode: null,
    morphology,
    fidelity: 'exact',
    labelJa: morphology,
    source: 'synthetic test fixture',
    confidence: 'high',
  };
}

// 合成ダイアグラム: vaporCoord='s'、暖バンドの下段は sTop が両端で異なる(1.0 → 0.5)
const SYNTH: ConditionDiagram = {
  id: 'ml66',
  vaporCoord: 's',
  tDomain: [-40, 0],
  rhoDomain: [0, 0.3],
  regions: {
    'ml66/warm-low': region('ml66/warm-low', '角板'),
    'ml66/warm-high': region('ml66/warm-high', '樹枝状'),
    'ml66/cold-low': region('ml66/cold-low', '角柱'),
    'ml66/cold-high': region('ml66/cold-high', '針'),
  },
  bands: [
    {
      tMax: 0,
      tMin: -20,
      stack: [{ regionId: 'ml66/warm-low', sTop: [1.0, 0.5] }, { regionId: 'ml66/warm-high' }],
    },
    {
      tMax: -20,
      tMin: -40,
      stack: [{ regionId: 'ml66/cold-low', sTop: [0.4, 0.2] }, { regionId: 'ml66/cold-high' }],
    },
  ],
};

/** s 座標の目標値から vapor (ρ) を逆算するヘルパー。 */
const vaporAt = (tc: number, s: number) => s * waterSaturationExcessDensity(tc);

describe('classifyOnDiagram (synthetic, vaporCoord=s)', () => {
  it('c. sTop(T) の線形補間: バンド中央で両端の中間値になる', () => {
    // 暖バンド (−20, 0]、t=−10 で sTop = (1.0 + 0.5)/2 = 0.75
    expect(classifyOnDiagram(-10, vaporAt(-10, 0.74), SYNTH).morphology).toBe('角板');
    expect(classifyOnDiagram(-10, vaporAt(-10, 0.76), SYNTH).morphology).toBe('樹枝状');
    // 1/4 点 t=−5 で sTop = 0.875
    expect(classifyOnDiagram(-5, vaporAt(-5, 0.86), SYNTH).morphology).toBe('角板');
    expect(classifyOnDiagram(-5, vaporAt(-5, 0.89), SYNTH).morphology).toBe('樹枝状');
  });

  it('c. 境界は下側所属(≤): s がちょうど sTop のとき下段', () => {
    // t=0(tMax 端)では sTop = 1.0 ちょうど。vapor = ρ_ws(0) なら s = 1.0(x/x=1 で厳密)
    const rho0 = waterSaturationExcessDensity(0);
    expect(classifyOnDiagram(0, rho0, SYNTH).morphology).toBe('角板');
    expect(classifyOnDiagram(0, rho0 * 1.0000001, SYNTH).morphology).toBe('樹枝状');
  });

  it('c. T のクランプ: 域外温度は端の値として扱われ、ρ_ws もクランプ後の T で評価', () => {
    // T=+10 → 0 にクランプ(sTop = 1.0)
    const rho0 = waterSaturationExcessDensity(0);
    expect(classifyOnDiagram(10, rho0, SYNTH).morphology).toBe('角板');
    expect(classifyOnDiagram(10, rho0 * 1.001, SYNTH).morphology).toBe('樹枝状');
    // T=−100 → −40 にクランプ(寒バンドの tMin 端、sTop = 0.2)
    expect(classifyOnDiagram(-100, vaporAt(-40, 0.19), SYNTH).morphology).toBe('角柱');
    expect(classifyOnDiagram(-100, vaporAt(-40, 0.21), SYNTH).morphology).toBe('針');
  });

  it('c. バンド境界 T=tMax は当該バンドに所属(T ∈ (tMin, tMax])', () => {
    // t=−20 は寒バンド (−40, −20] に所属(暖バンドは t > −20 を要求)
    expect(classifyOnDiagram(-20, vaporAt(-20, 0.1), SYNTH).morphology).toBe('角柱');
    // すぐ上の t=−19.99 は暖バンド
    expect(classifyOnDiagram(-19.99, vaporAt(-19.99, 0.1), SYNTH).morphology).toBe('角板');
  });

  it('c. RegionHit が region / mlCode を返す', () => {
    const hit = classifyOnDiagram(-10, vaporAt(-10, 0.1), SYNTH);
    expect(hit.region.id).toBe('ml66/warm-low');
    expect(hit.mlCode).toBeNull();
  });
});
