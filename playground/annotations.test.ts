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
import { SCALELIKE_SIDE_PLANE_PARAMS } from '../src/geometry/morphologies';

/** union 16 値(網羅は Record 型で tsc が保証 — ここでは実行時の鍵集合を固定)。 */
const ALL_MORPHOLOGIES: Morphology[] = [
  '針',
  'さや',
  '角柱',
  '骸晶角柱',
  '角板',
  '厚角板',
  '骸晶角板',
  '扇形',
  '広幅枝',
  '樹枝状',
  '砲弾集合',
  '側面',
  '鱗状側面',
  '星状',
  '羊歯',
  '長柱',
];

describe('ANNOTATIONS(案 N §3 の 14 形態 + 広幅枝・鱗状側面(案 K)対応表)', () => {
  it('16 形態を網羅する', () => {
    expect(Object.keys(ANNOTATIONS).sort()).toEqual([...ALL_MORPHOLOGIES].sort());
  });

  it('族位相は 0(builder)または π/6(Cylinder)に限る', () => {
    for (const m of ALL_MORPHOLOGIES) {
      expect([BUILDER_PHASE, CYLINDER_PHASE]).toContain(ANNOTATIONS[m].phaseRad);
    }
  });

  it('族割当(§2.2 F1): builder 0° = 骸晶角柱・さや・針、例外形態(砲弾集合・側面族)は基準値 0', () => {
    const builderPhase: Morphology[] = ['骸晶角柱', 'さや', '針', '砲弾集合', '側面', '鱗状側面'];
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
    expect(degs('広幅枝')).toEqual([]);
    expect(degs('樹枝状')).toEqual([60, -60]);
    expect(degs('星状')).toEqual([]);
    expect(degs('羊歯')).toEqual([60, -60]);
    expect(degs('砲弾集合')).toEqual([28.0]);
    expect(degs('側面')).toEqual([70.3]);
    expect(degs('鱗状側面')).toEqual([70.3]); // CSL アンカーは側面族で共通(案 K §4.2)
  });

  it('広幅枝(案 K K-a): 扇形と同族(Cylinder 位相・包絡 1.52)+ 仮実装の一文注記', () => {
    const spec = ANNOTATIONS['広幅枝'];
    expect(spec.phaseRad).toBe(CYLINDER_PHASE); // 花弁方位 30° + k·60°(両案共通)・ハブ = Cylinder 族
    expect(spec.envelope).toEqual({ radius: 1.52, height: 0.2 }); // 案 1 先端(案 2 の 1.40 を包含)
    expect(spec.axes).toBe('standard');
    expect(spec.note?.ja).toContain('仮実装');
  });

  it('鱗状側面(案 K K-b): 側面と同族(spine 軸・builder 基準値 0)+ 専用レイアウト + 仮実装の一文注記', () => {
    const spec = ANNOTATIONS['鱗状側面'];
    expect(spec.phaseRad).toBe(BUILDER_PHASE); // スパイン = a 軸 ∥ +Y(R7)— 側面と同じ例外形態の基準値
    expect(spec.axes).toBe('spine');
    // 包絡: 水平 (√3/2)·0.5·1.2 ≈ 0.52 / スパイン ±(0.5·1.2 + 0.9·0.5) = ±1.05
    expect(spec.envelope).toEqual({ radius: 0.52, height: 2.1 });
    // 二面角弧は専用レイアウト(SCALELIKE_SIDE_PLANE_PARAMS)の再生から張る
    expect(spec.sidePlaneParams).toBe(SCALELIKE_SIDE_PLANE_PARAMS);
    expect(ANNOTATIONS['側面'].sidePlaneParams).toBeUndefined(); // S1 は既定レイアウトのまま
    expect(spec.note?.ja).toContain('仮実装');
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

  it('鱗状側面: 専用レイアウトの二面角弧も CSL アンカー 70.3°・S1 の弧とは独立', () => {
    const arc = sidePlaneDihedralArc(SCALELIKE_SIDE_PLANE_PARAMS);
    expect(arc.toRotationDeg - arc.fromRotationDeg).toBeCloseTo(70.3, 10);
    expect(sidePlaneDihedralArc(SCALELIKE_SIDE_PLANE_PARAMS)).toEqual(arc); // 決定性
    // 既定シードでは S1(4〜7 枚)と鱗状(6〜7 枚)で配置列が異なる(枚数抽選が別)
    expect(arc).not.toEqual(sidePlaneDihedralArc());
  });
});
