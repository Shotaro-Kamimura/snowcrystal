import { describe, it, expect } from 'vitest';
import { PROVISIONAL_PREFIX, provisionalSuffix } from './provisional';
import { ML66 } from './ml66';

// 案 K(CP-K2)仮フラグ規約のテスト(設計書 §2.1)。
// UI バッジ(playground)はこのパーサで導出し、ハードコード表を持たない。

describe('案K provisionalSuffix — source 接頭辞パース', () => {
  it("a. 接頭辞 'provisional: ' の後続文(何が仮か)を返し、非仮・旧規約(裸)・空 suffix は null", () => {
    expect(provisionalSuffix('provisional: 形状解釈(確認(1)待ち)')).toBe(
      '形状解釈(確認(1)待ち)',
    );
    expect(provisionalSuffix('ML66 Fig.2(デジタイズ済)')).toBeNull();
    expect(provisionalSuffix('')).toBeNull();
    // 旧規約の裸 'provisional'(P1f の旧値)は機械可読フラグとして扱わない —
    // CP-K2 の正規化が必要だった根拠
    expect(provisionalSuffix('provisional')).toBeNull();
    // 接頭辞のみ(suffix 空)は規約違反として null(後続文は必須 — §2.1)
    expect(provisionalSuffix(PROVISIONAL_PREFIX)).toBeNull();
  });

  it('b. ML66 データセット統合: 仮 region は P1c・P1f の 2 件のみ、suffix が「何が仮か」を読み分ける', () => {
    const provisional = Object.values(ML66.regions)
      .filter((r) => provisionalSuffix(r.source) !== null)
      .map((r) => r.id)
      .sort();
    expect(provisional).toEqual(['ml66/P1c', 'ml66/P1f']);

    // 「形状解釈が仮」(K-a)と「図上範囲が仮」(P1f)は suffix の文章で区別(フラグは共通)
    expect(provisionalSuffix(ML66.regions['ml66/P1c'].source)).toBe(
      '形状解釈(確認(1)待ち)— ML66 Fig.2(デジタイズ・ユーザー同定 2026-06-10)',
    );
    expect(provisionalSuffix(ML66.regions['ml66/P1f'].source)).toBe(
      '図上範囲(独自定義・出典なし)',
    );
  });
});
