import { describe, it, expect } from 'vitest';
import { THREE } from '../three';
import { A_AXES, CSL_TWIN_ANGLE_DEG, halfHexOutline } from './crystallography';
import { SIDE_PLANE_OFFSETS_DEG, sampleSidePlaneLayout } from './parts';
import { mulberry32 } from '../random';
import { createSnowCrystal, disposeCrystal } from '../createSnowCrystal';

const DEG = 180 / Math.PI;

type Pt = [number, number];

function interiorAngleDeg(pts: Pt[], v: number): number {
  const prev = pts[(v + pts.length - 1) % pts.length];
  const next = pts[(v + 1) % pts.length];
  const cur = pts[v];
  const u = [prev[0] - cur[0], prev[1] - cur[1]];
  const w = [next[0] - cur[0], next[1] - cur[1]];
  const dot = u[0] * w[0] + u[1] * w[1];
  return Math.acos(dot / (Math.hypot(u[0], u[1]) * Math.hypot(w[0], w[1]))) * DEG;
}

function minCircularGapDeg(angles: number[]): number {
  const sorted = [...angles].sort((a, b) => a - b);
  let min = 360 - sorted[sorted.length - 1] + sorted[0];
  for (let i = 0; i + 1 < sorted.length; i++) {
    min = Math.min(min, sorted[i + 1] - sorted[i]);
  }
  return min;
}

describe('halfHexOutline(設計書 §7-1)', () => {
  it('a. 内角列 60/120/120/60・スパイン辺長 = 2R・スパインが a 軸方向', () => {
    for (const R of [1, 0.85, 2]) {
      const pts = halfHexOutline(R);
      expect(pts).toHaveLength(4);

      const angles = pts.map((_, i) => interiorAngleDeg(pts, i));
      const expected = [60, 120, 120, 60];
      angles.forEach((a, i) => expect(Math.abs(a - expected[i]), `R=${R} 頂点${i}`).toBeLessThan(1e-6));

      // スパイン辺 = 最終頂点 → 先頭頂点(閉路辺)
      const spine = [pts[0][0] - pts[3][0], pts[0][1] - pts[3][1]];
      const len = Math.hypot(spine[0], spine[1]);
      expect(Math.abs(len - 2 * R)).toBeLessThan(1e-12);

      // 方向が a 軸 A_AXES[0] = [1, 0] と一致
      const dot = (spine[0] / len) * A_AXES[0][0] + (spine[1] / len) * A_AXES[0][1];
      expect(Math.abs(dot - 1)).toBeLessThan(1e-12);
    }
  });
});

describe('CSL_TWIN_ANGLE_DEG(設計書 §7-2)', () => {
  it('b. 定義値 70.3(±1e-9)', () => {
    expect(Math.abs(CSL_TWIN_ANGLE_DEG - 70.3)).toBeLessThan(1e-9);
  });

  it('b. オフセット規定集合が 7 要素 {0, ±70.3, ±109.7, ±140.6}', () => {
    const sorted = [...SIDE_PLANE_OFFSETS_DEG].sort((a, b) => a - b);
    expect(sorted).toEqual([-140.6, -109.7, -70.3, 0, 70.3, 109.7, 140.6]);
  });
});

describe('sampleSidePlaneLayout(設計書 §7-3)', () => {
  it('c. 決定性: 同一 seed → 完全一致、別 seed(42 vs 7)→ 相違', () => {
    const a = sampleSidePlaneLayout(mulberry32(42));
    const b = sampleSidePlaneLayout(mulberry32(42));
    expect(b).toEqual(a);

    // 実測確認済み: seed 42 → 6枚 / seed 7 → 4枚(配置列も相違)
    const other = sampleSidePlaneLayout(mulberry32(7));
    expect(other).not.toEqual(a);
  });

  it('c. 固定 seed 数件: 本数 ∈ [4,7]・最小角間隔 ≥ 20°・オフセットが規定集合の要素', () => {
    for (const seed of [1, 2, 3, 7, 42, 123, 2024]) {
      const fins = sampleSidePlaneLayout(mulberry32(seed));
      expect(fins.length, `seed ${seed} 本数`).toBeGreaterThanOrEqual(4);
      expect(fins.length, `seed ${seed} 本数`).toBeLessThanOrEqual(7);
      expect(
        minCircularGapDeg(fins.map((f) => f.angleDeg)),
        `seed ${seed} 最小角間隔`,
      ).toBeGreaterThanOrEqual(20 - 1e-9);
      for (const fin of fins) {
        // 全 seed で案B成立(フォールバックなし)を実測確認済み → null でないこと
        expect(fin.baseOffsetDeg, `seed ${seed} オフセット`).not.toBeNull();
        expect(
          SIDE_PLANE_OFFSETS_DEG.some((o) => Math.abs(o - fin.baseOffsetDeg!) < 1e-9),
          `seed ${seed} オフセット ${fin.baseOffsetDeg} が規定集合外`,
        ).toBe(true);
        expect(fin.radiusScale).toBeGreaterThanOrEqual(0.8);
        expect(fin.radiusScale).toBeLessThanOrEqual(1.2);
        expect(Math.abs(fin.staggerRatio)).toBeLessThanOrEqual(0.4);
      }
      // オフセットの重複なし
      const offsets = fins.map((f) => f.baseOffsetDeg);
      expect(new Set(offsets).size).toBe(offsets.length);
    }
  });

  it('c. N=7 でも案Bが成立する(±140.6 拡張の確認、seed 123)', () => {
    const fins = sampleSidePlaneLayout(mulberry32(123));
    expect(fins).toHaveLength(7);
    expect(fins.every((f) => f.baseOffsetDeg !== null)).toBe(true);
  });
});

describe('側面スモーク(設計書 §7-4)', () => {
  it('d. createSnowCrystal({morphology:側面, seed:42}) が Group を返し dispose 可能', () => {
    const group = createSnowCrystal({ morphology: '側面', seed: 42 });
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children.length).toBeGreaterThanOrEqual(4);
    expect(group.children.length).toBeLessThanOrEqual(7);
    expect(() => disposeCrystal(group)).not.toThrow();
  });
});
