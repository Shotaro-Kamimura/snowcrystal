import { describe, it, expect } from 'vitest';
import { NAKAYA_V1 } from './nakaya-v1';
import { classifyOnDiagram } from './lookup';
import type { Morphology } from '../types';

// ステップ2で getCrystalType の既定が ML66 へ切り替わったため、
// v1 回帰は NAKAYA_V1 を明示指定して比較する(設計書 §9-4)。
const nakayaV1 = (t: number, v: number): Morphology =>
  classifyOnDiagram(t, v, NAKAYA_V1).morphology;

/**
 * 旧実装(v1 の if-else)の oracle 移植。
 * リファクタ前の src/classify.ts getCrystalType と逐語一致。
 */
function legacyGetCrystalType(temp: number, vapor: number): Morphology {
  if (temp <= 0 && temp > -4) {
    if (vapor >= 0.1 && vapor <= 0.3) return '角板';
  } else if (temp <= -4 && temp > -10) {
    if (vapor <= 0.05) return '角柱';
    if (vapor <= 0.1) return '骸晶角柱';
    if (vapor <= 0.15) return 'さや';
    return '針';
  } else if (temp <= -10 && temp > -22) {
    if (vapor <= 0.05) return '厚角板';
    if (vapor <= 0.15) return '骸晶角板';
    if (vapor <= 0.2) return '扇形';
    return '樹枝状';
  } else if (temp <= -22 && temp >= -40) {
    if (vapor <= 0.05) return '角柱';
    if (vapor <= 0.1) return '骸晶角柱';
    return 'さや';
  }

  return '角板'; // fallback
}

describe('NAKAYA_V1 回帰(挙動不変)', () => {
  it('a. 全格子 T=0..−40(0.1刻み) × vapor=0..0.3(0.005刻み)で旧実装と完全一致', () => {
    const mismatches: string[] = [];
    let points = 0;
    for (let i = 0; i <= 400; i++) {
      const t = -i / 10;
      for (let j = 0; j <= 60; j++) {
        const v = j * 0.005;
        points++;
        const expected = legacyGetCrystalType(t, v);
        const actual = nakayaV1(t, v);
        if (actual !== expected) {
          mismatches.push(`(${t}, ${v}): expected ${expected}, got ${actual}`);
        }
      }
    }
    expect(points).toBe(401 * 61); // 24,461 点
    expect(mismatches).toEqual([]);
  });

  it('a. 境界点の明示ケース(T=−4/−10/−22 × vapor=0.05/0.10/0.15/0.20 ほか)', () => {
    const cases: Array<[number, number, Morphology]> = [
      // T=−4 はバンド (−10, −4] に所属
      [-4, 0.05, '角柱'],
      [-4, 0.1, '骸晶角柱'],
      [-4, 0.15, 'さや'],
      [-4, 0.2, '針'],
      // T=−10 はバンド (−22, −10] に所属
      [-10, 0.05, '厚角板'],
      [-10, 0.1, '骸晶角板'],
      [-10, 0.15, '骸晶角板'],
      [-10, 0.2, '扇形'],
      // T=−22 はバンド [−40, −22] に所属
      [-22, 0.05, '角柱'],
      [-22, 0.1, '骸晶角柱'],
      [-22, 0.15, 'さや'],
      [-22, 0.2, 'さや'],
      // ドメイン両端
      [0, 0.05, '角板'],
      [0, 0.25, '角板'],
      [-40, 0.05, '角柱'],
      [-40, 0.25, 'さや'],
    ];
    for (const [t, v, expected] of cases) {
      expect(nakayaV1(t, v), `(${t}, ${v})`).toBe(expected);
    }
  });
});

describe('NAKAYA_V1 スキーマ不変条件', () => {
  it('d. バンドが tMax 降順で tDomain を隙間なく被覆する', () => {
    const { bands, tDomain } = NAKAYA_V1;
    expect(bands[0].tMax).toBe(tDomain[1]);
    for (let i = 0; i < bands.length; i++) {
      expect(bands[i].tMax).toBeGreaterThan(bands[i].tMin);
      if (i + 1 < bands.length) {
        expect(bands[i].tMin).toBe(bands[i + 1].tMax);
      }
    }
    expect(bands[bands.length - 1].tMin).toBe(tDomain[0]);
  });

  it('d. 各バンド: 最上段のみ sTop なし(∞)、sTop は下から両端とも単調増加、regionId は解決可能', () => {
    for (const band of NAKAYA_V1.bands) {
      band.stack.forEach((entry, idx) => {
        expect(NAKAYA_V1.regions[entry.regionId], entry.regionId).toBeDefined();
        if (idx < band.stack.length - 1) {
          expect(entry.sTop, `${entry.regionId} (非最上段)`).toBeDefined();
        } else {
          expect(entry.sTop, `${entry.regionId} (最上段)`).toBeUndefined();
        }
      });
      for (let k = 0; k + 2 < band.stack.length; k++) {
        const lower = band.stack[k].sTop!;
        const upper = band.stack[k + 1].sTop!;
        expect(upper[0]).toBeGreaterThan(lower[0]);
        expect(upper[1]).toBeGreaterThan(lower[1]);
      }
    }
  });
});
