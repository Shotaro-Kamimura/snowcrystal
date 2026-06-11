// 案 N 注記対応表の整合テスト(設計書 §5 裁量 5 (a))。
// playground 内で完結 — src/ のテスト 89 件には触れない。
import { describe, expect, it } from 'vitest';
import type { Morphology } from '../src/index';
import {
  ANNOTATIONS,
  BUILDER_PHASE,
  CYLINDER_PHASE,
  ICE_C_OVER_A,
  ROSETTE_DISPLAY,
  rosetteRepresentativeArm,
  sidePlaneDihedralArc,
} from './annotations';

/** union 14 値(網羅は Record 型で tsc が保証 — ここでは実行時の鍵集合を固定)。 */
const ALL_MORPHOLOGIES: Morphology[] = [
  '針',
  'さや',
  '角柱',
  '骸晶角柱',
  '角板',
  '厚角板',
  '骸晶角板',
  '扇形',
  '樹枝状',
  '砲弾集合',
  '側面',
  '星状',
  '羊歯',
  '長柱',
];

describe('ANNOTATIONS(案 N §3 の 14 形態対応表)', () => {
  it('14 形態を網羅する', () => {
    expect(Object.keys(ANNOTATIONS).sort()).toEqual([...ALL_MORPHOLOGIES].sort());
  });

  it('族位相は 0(builder)または π/6(Cylinder)に限る', () => {
    for (const m of ALL_MORPHOLOGIES) {
      expect([BUILDER_PHASE, CYLINDER_PHASE]).toContain(ANNOTATIONS[m].phaseRad);
    }
  });

  it('族割当(§2.2 F1): builder 0° = 骸晶角柱・さや・針、例外 2 形態は基準値 0', () => {
    const builderPhase: Morphology[] = ['骸晶角柱', 'さや', '針', '砲弾集合', '側面'];
    for (const m of ALL_MORPHOLOGIES) {
      expect(ANNOTATIONS[m].phaseRad, m).toBe(
        builderPhase.includes(m) ? BUILDER_PHASE : CYLINDER_PHASE,
      );
    }
  });

  it('角度値は {120, 240, ±60, 28.0, 70.3} に限る', () => {
    const allowed = [120, 240, 60, -60, 28.0, 70.3];
    for (const m of ALL_MORPHOLOGIES) {
      for (const arc of ANNOTATIONS[m].arcs) {
        expect(allowed, `${m}: ${arc.deg}`).toContain(arc.deg);
      }
    }
  });

  it('角度注記の形態別対応(§3 の表)', () => {
    const degs = (m: Morphology): number[] => ANNOTATIONS[m].arcs.map((a) => a.deg);
    expect(degs('角板')).toEqual([120]);
    expect(degs('厚角板')).toEqual([120]);
    expect(degs('骸晶角板')).toEqual([120]);
    expect(degs('角柱')).toEqual([120]);
    expect(degs('長柱')).toEqual([120]);
    expect(degs('骸晶角柱')).toEqual([120, 240]);
    expect(degs('さや')).toEqual([240]);
    expect(degs('針')).toEqual([240]);
    expect(degs('扇形')).toEqual([]);
    expect(degs('樹枝状')).toEqual([60, -60]);
    expect(degs('星状')).toEqual([]);
    expect(degs('羊歯')).toEqual([60, -60]);
    expect(degs('砲弾集合')).toEqual([28.0]);
    expect(degs('側面')).toEqual([70.3]);
  });

  it('包絡定数は正・軸モードと付帯データが整合する', () => {
    for (const m of ALL_MORPHOLOGIES) {
      const spec = ANNOTATIONS[m];
      expect(spec.envelope.radius, m).toBeGreaterThan(0);
      expect(spec.envelope.height, m).toBeGreaterThan(0);
      // 120°/240° 弧と面ラベルは六角断面を要する
      if (spec.arcs.some((a) => a.kind === 'interior' || a.kind === 'reflex')) {
        expect(spec.hexSection, m).toBeDefined();
      }
      if (spec.arcs.some((a) => a.kind === 'reflex')) {
        expect(spec.dent, m).toBeDefined();
      }
      if (spec.arcs.some((a) => a.kind === 'sideBranch')) {
        expect(spec.sideBranchJunctionZ, m).toBeGreaterThan(0);
      }
    }
  });
});

describe('シード依存形態の代表要素(既定シードの決定性再生)', () => {
  it('砲弾集合: 代表腕は単位ベクトル・ロール ∈ [0, 2π)・腕長 = R·c/a + L', () => {
    const arm = rosetteRepresentativeArm();
    expect(Math.hypot(...arm.axis)).toBeCloseTo(1, 10);
    expect(arm.rollRad).toBeGreaterThanOrEqual(0);
    expect(arm.rollRad).toBeLessThan(2 * Math.PI);
    expect(arm.armLength).toBeCloseTo(
      ROSETTE_DISPLAY.radius * ICE_C_OVER_A + ROSETTE_DISPLAY.bodyLength,
      10,
    );
    expect(rosetteRepresentativeArm()).toEqual(arm); // 決定性
  });

  it('側面: 二面角弧のスパンは CSL アンカー 70.3°', () => {
    const arc = sidePlaneDihedralArc();
    expect(arc.toRotationDeg - arc.fromRotationDeg).toBeCloseTo(70.3, 10);
    expect(sidePlaneDihedralArc()).toEqual(arc); // 決定性
  });
});
