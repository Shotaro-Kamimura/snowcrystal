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
      [-15, 0.9, '広幅枝'], // 広幅枝(P1c)領域 → 専用描画(案 K K-a、CP-K2 で扇形近似を解消)
      [-15, 1.05, '星状'], // 星状(P1d)領域 → 専用描画(案 M、CP-M2 で樹枝状近似を解消)
      [-12, 1.2, '骸晶角板'], // 隣接バンド (−13,−10] は非変更(不変確認)
      [-2, 0.5, '角板'],
      [-22, 0.3, '角柱'], // 対角線の下(t=−22 で sTop ≈ 0.32)
      [-22, 0.8, '骸晶角柱'], // C1f
      [-23, 1.2, '砲弾集合'],
      [-23, 1.8, '側面'], // S1(水飽和の上、ML66 原典忠実)
      [-27, 0.7, '角柱'], // 対角線の下(t=−27 で sTop = 0.745)
      [-27, 0.9, '骸晶角柱'], // C1f
      [-33, 0.5, '長柱'], // 長柱(N1e)領域 → 専用描画(案 M、CP-M2 で角柱近似を解消)
      [-33, 1.2, '砲弾集合'],
      [-33, 1.8, '側面'], // S2
      [-38, 1.8, '砲弾集合'], // S2 は −35 まで。−35 以深の最上段は C2a
    ];
    for (const [t, s, expected] of cases) {
      expect(getCrystalType(t, vaporAt(t, s)), `(${t}°C, s=${s})`).toBe(expected);
    }
  });

  it('a. v1 定番条件の互換: (−15, ρ=0.25) → ml66/P1e・樹枝状(領域・形態とも不変)', () => {
    // P1d/P1c 修正(2026-06-10)後も s ≈ 1.145 は P1d 上限 1.12 と P1e 上限 1.35 の間に
    // とどまるため、v1 定番の目視条件は領域(P1e)・形態(樹枝状)とも不変であることを固定する
    expect(getCrystalType(-15, 0.25)).toBe('樹枝状');
    const hit = classifyOnDiagram(-15, 0.25, ML66);
    expect(hit.region.id).toBe('ml66/P1e');
  });

  it('a. 領域メタデータ: 広幅枝は P1c/approx、星状は P1d/exact(案 M)、長柱は labelJa付きの専用形態', () => {
    const kouhaba = classifyOnDiagram(-15, vaporAt(-15, 0.9), ML66);
    expect(kouhaba.mlCode).toBe('P1c');
    expect(kouhaba.region.fidelity).toBe('approx'); // 仮実装中は据え置き(案 K §2.1)
    expect(kouhaba.morphology).toBe('広幅枝');

    const hoshi = classifyOnDiagram(-15, vaporAt(-15, 1.05), ML66);
    expect(hoshi.mlCode).toBe('P1d');
    expect(hoshi.region.fidelity).toBe('exact');
    expect(hoshi.morphology).toBe('星状');

    const naga = classifyOnDiagram(-33, vaporAt(-33, 0.5), ML66);
    expect(naga.mlCode).toBe('N1e');
    expect(naga.region.labelJa).toBe('長柱');
    expect(naga.morphology).toBe('長柱');
  });

  it('d. 案M 領域割当: P1d → 星状 / P1f → 羊歯 / N1e → 長柱、fidelity exact(labelJa・source・confidence 不変)', () => {
    const p1d = ML66.regions['ml66/P1d'];
    expect(p1d.morphology).toBe('星状');
    expect(p1d.fidelity).toBe('exact');
    expect(p1d.labelJa).toBe('星状');
    expect(p1d.source).toBe(
      'ML66 Fig.2(デジタイズ済・赤スケッチ)。水飽和直上への移動はユーザーのスケッチ同定(赤枠=P1d)による 2026-06-10 修正',
    ); // 2026-06-10 修正の経緯を記録する文字列 — 退行検知のため固定
    expect(p1d.confidence).toBe('mid');

    const p1f = ML66.regions['ml66/P1f'];
    expect(p1f.morphology).toBe('羊歯');
    expect(p1f.fidelity).toBe('exact');
    expect(p1f.labelJa).toBe('羊歯');
    // 旧 'provisional'(裸)→ 新規約 'provisional: <何が仮か>' へ正規化(案 K §2.1・CP-K2 裁量 2)
    expect(p1f.source).toBe('provisional: 図上範囲(独自定義・出典なし)');
    expect(p1f.confidence).toBe('low');

    const n1e = ML66.regions['ml66/N1e'];
    expect(n1e.morphology).toBe('長柱');
    expect(n1e.fidelity).toBe('exact');
    expect(n1e.labelJa).toBe('長柱');
    expect(n1e.source).toBe('ML66 §3.1(Shimizu)');
  });

  it('e. 案K P1c 割当・目視定番ゴールデン: (−15, 0.20) → ml66/P1c・広幅枝・approx・provisional 接頭辞', () => {
    // 積乱雲コース(案 K §6.2)のステージ①と同値の定番条件
    const hit = classifyOnDiagram(-15, 0.2, ML66);
    expect(hit.region.id).toBe('ml66/P1c');
    expect(hit.morphology).toBe('広幅枝');
    expect(hit.region.labelJa).toBe('広幅枝');
    expect(hit.region.fidelity).toBe('approx');
    // 機械可読の仮フラグは接頭辞 1 本(案 K §2.1)。確認(1)の連動と既存出典の続記を固定
    expect(hit.region.source).toBe(
      'provisional: 形状解釈(確認(1)待ち)— ML66 Fig.2(デジタイズ・ユーザー同定 2026-06-10)',
    );
    expect(hit.region.confidence).toBe('mid'); // 図上範囲の確度は据え置き(描画の仮とは独立)
  });

  it('d. 案M 目視定番ゴールデン: 星状 (−15, 0.23) P1d / 羊歯 (−16, 0.29) P1f / 長柱 (−33, 0.05) N1e', () => {
    const cases = [
      [-15, 0.23, 'ml66/P1d', '星状'],
      [-16, 0.29, 'ml66/P1f', '羊歯'],
      [-33, 0.05, 'ml66/N1e', '長柱'],
    ] as const;
    for (const [t, v, regionId, morph] of cases) {
      const hit = classifyOnDiagram(t, v, ML66);
      expect(hit.region.id, `(${t}, ${v})`).toBe(regionId);
      expect(hit.morphology).toBe(morph);
    }
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
