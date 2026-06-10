import { describe, it, expect } from 'vitest';
import { THREE } from '../three';
import { CANONICAL_ROSETTE_AXES, sampleRosetteAxes } from './rosette';
import type { Vec3 } from './rosette';
import { mulberry32 } from '../random';
import { createSnowCrystal, disposeCrystal } from '../createSnowCrystal';

const DEG = 180 / Math.PI;

function angleDeg(a: Vec3, b: Vec3): number {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.max(-1, Math.min(1, d))) * DEG;
}

function minMutualAngleDeg(axes: readonly Vec3[]): number {
  let min = 180;
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      min = Math.min(min, angleDeg(axes[i], axes[j]));
    }
  }
  return min;
}

describe('sampleRosetteAxes(設計書 §5-3)', () => {
  it('a. 決定性: 同一 seed → 軸列が完全一致、異 seed(42 vs 7)→ 異なる', () => {
    const axes1 = sampleRosetteAxes(mulberry32(42));
    const axes2 = sampleRosetteAxes(mulberry32(42));
    expect(axes2).toEqual(axes1);

    // 実測確認済み: seed 42 → 5本 / seed 7 → 3本(軸列も相違)
    const other = sampleRosetteAxes(mulberry32(7));
    expect(other).not.toEqual(axes1);
  });

  it('b. 制約: 固定 seed 数件で本数 ∈ [3,6]・全ペア相互角 ≥ 50°', () => {
    for (const seed of [1, 2, 3, 7, 42, 123, 9999]) {
      const axes = sampleRosetteAxes(mulberry32(seed));
      expect(axes.length, `seed ${seed} 本数`).toBeGreaterThanOrEqual(3);
      expect(axes.length, `seed ${seed} 本数`).toBeLessThanOrEqual(6);
      expect(minMutualAngleDeg(axes), `seed ${seed} 最小相互角`).toBeGreaterThanOrEqual(50 - 1e-9);
      for (const v of axes) {
        expect(Math.abs(Math.hypot(...v) - 1), `seed ${seed} 単位長`).toBeLessThan(1e-12);
      }
    }
  });

  it('c. 正準配置: 3〜6 すべて単位長・全ペア ≥ 50°、四面体 ≈109.47°・八面体 90°/180°', () => {
    for (const n of [3, 4, 5, 6] as const) {
      const axes = CANONICAL_ROSETTE_AXES[n];
      expect(axes).toHaveLength(n);
      for (const v of axes) {
        expect(Math.abs(Math.hypot(...v) - 1), `n=${n} 単位長`).toBeLessThan(1e-12);
      }
      expect(minMutualAngleDeg(axes), `n=${n} 最小相互角`).toBeGreaterThanOrEqual(50);
    }

    // 四面体(と三脚はその部分集合): 全ペアが arccos(-1/3) ≈ 109.47°
    const tetra = CANONICAL_ROSETTE_AXES[4];
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        expect(Math.abs(angleDeg(tetra[i], tetra[j]) - 109.4712)).toBeLessThanOrEqual(0.1);
      }
    }

    // 八面体: 全ペアが 90°(隣接)または 180°(対蹠)
    const octa = CANONICAL_ROSETTE_AXES[6];
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        const a = angleDeg(octa[i], octa[j]);
        expect(Math.min(Math.abs(a - 90), Math.abs(a - 180))).toBeLessThanOrEqual(0.1);
      }
    }
  });
});

describe('砲弾集合スモーク(設計書 §5-4)', () => {
  it('d. createSnowCrystal({morphology:砲弾集合, seed:42}) が Group を返し dispose 可能', () => {
    const group = createSnowCrystal({ morphology: '砲弾集合', seed: 42 });
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children.length).toBeGreaterThan(0);
    expect(() => disposeCrystal(group)).not.toThrow();
  });
});
