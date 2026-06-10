import { describe, it, expect } from 'vitest';
import { ML66 } from './ml66';
import { classifyOnDiagram } from './lookup';
import { waterSaturationExcessDensity } from './saturation';
import { getCrystalType } from '../classify';
import type { Morphology } from '../types';

/** 相対飽和 s の目標値から vapor (ρ [g/m³]) を逆算。 */
const vaporAt = (tc: number, s: number) => s * waterSaturationExcessDensity(tc);

describe('ML66 ゴールデン(一次資料アンカー)', () => {
  it('a. 代表条件の分類(s 指定)', () => {
    const cases: Array<[tempC: number, s: number, expected: Morphology]> = [
      [-5, 1.2, '針'],
      [-7, 1.2, 'さや'],
      [-9, 1.2, '骸晶角柱'],
      [-15, 0.9, '樹枝状'], // 星状(P1d)領域 → 描画は樹枝状
      [-12, 1.2, '骸晶角板'],
      [-2, 0.5, '角板'],
      [-22, 0.3, '角柱'], // 対角線の下(t=−22 で sTop ≈ 0.32)
      [-22, 0.8, '骸晶角柱'], // C1f
      [-23, 1.2, '砲弾集合'],
      [-23, 1.8, '側面'], // S1(水飽和の上、ML66 原典忠実)
      [-27, 0.7, '角柱'], // 対角線の下(t=−27 で sTop = 0.745)
      [-27, 0.9, '骸晶角柱'], // C1f
      [-33, 0.5, '角柱'], // 長柱(N1e)領域
      [-33, 1.2, '砲弾集合'],
      [-33, 1.8, '側面'], // S2
      [-38, 1.8, '砲弾集合'], // S2 は −35 まで。−35 以深の最上段は C2a
    ];
    for (const [t, s, expected] of cases) {
      expect(getCrystalType(t, vaporAt(t, s)), `(${t}°C, s=${s})`).toBe(expected);
    }
  });

  it('a. v1 定番条件の互換: (−15, ρ=0.25) → 樹枝状', () => {
    expect(getCrystalType(-15, 0.25)).toBe('樹枝状');
  });

  it('a. 領域メタデータ: 星状は P1d/approx、長柱は labelJa付きの角柱', () => {
    const hoshi = classifyOnDiagram(-15, vaporAt(-15, 0.9), ML66);
    expect(hoshi.mlCode).toBe('P1d');
    expect(hoshi.region.fidelity).toBe('approx');
    expect(hoshi.morphology).toBe('樹枝状');

    const naga = classifyOnDiagram(-33, vaporAt(-33, 0.5), ML66);
    expect(naga.mlCode).toBe('N1e');
    expect(naga.region.labelJa).toBe('長柱');
    expect(naga.morphology).toBe('角柱');
  });

  it('b. 対角線の連続性: C1e の sTop が T=−25 で両隣バンドから一致(0.575)', () => {
    const warm = ML66.bands.find((b) => b.tMax === -20 && b.tMin === -25)!;
    const cold = ML66.bands.find((b) => b.tMax === -25 && b.tMin === -30)!;
    expect(warm.stack[0].regionId).toBe('ml66/C1e');
    expect(cold.stack[0].regionId).toBe('ml66/C1e');
    expect(warm.stack[0].sTop![1]).toBe(0.575); // 低温端 (−25)
    expect(cold.stack[0].sTop![0]).toBe(0.575); // 高温端 (−25)
  });
});

describe('ML66 スキーマ不変条件', () => {
  it('c. バンドが tMax 降順で tDomain を隙間なく被覆する', () => {
    const { bands, tDomain, vaporCoord } = ML66;
    expect(vaporCoord).toBe('s');
    expect(bands[0].tMax).toBe(tDomain[1]);
    for (let i = 0; i < bands.length; i++) {
      expect(bands[i].tMax).toBeGreaterThan(bands[i].tMin);
      if (i + 1 < bands.length) {
        expect(bands[i].tMin).toBe(bands[i + 1].tMax);
      }
    }
    expect(bands[bands.length - 1].tMin).toBe(tDomain[0]);
  });

  it('c. 各バンド: 最上段のみ sTop なし(∞)、sTop は両端とも非減少、regionId は解決可能', () => {
    for (const band of ML66.bands) {
      band.stack.forEach((entry, idx) => {
        expect(ML66.regions[entry.regionId], entry.regionId).toBeDefined();
        if (idx < band.stack.length - 1) {
          expect(entry.sTop, `${entry.regionId} (非最上段)`).toBeDefined();
        } else {
          expect(entry.sTop, `${entry.regionId} (最上段)`).toBeUndefined();
        }
      });
      // 非減少(対角線が −30 で水飽和に収束し同値端点が生じるため、狭義増加は要求しない)
      for (let k = 0; k + 2 < band.stack.length; k++) {
        const lower = band.stack[k].sTop!;
        const upper = band.stack[k + 1].sTop!;
        expect(upper[0]).toBeGreaterThanOrEqual(lower[0]);
        expect(upper[1]).toBeGreaterThanOrEqual(lower[1]);
      }
    }
  });
});
