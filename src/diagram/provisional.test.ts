import { describe, it, expect } from 'vitest';
import {
  PROVISIONAL_PREFIX,
  PROVISIONAL_CATEGORIES,
  provisionalSuffix,
  parseProvisionalSource,
} from './provisional';
import { ML66 } from './ml66';
import { COMPOSITE_TABLE } from '../growth/composites';

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

  it('b. ML66 データセット統合: 仮 region は P1c・P1f・S2 の 3 件、suffix が「何が仮か」を読み分ける', () => {
    const provisional = Object.values(ML66.regions)
      .filter((r) => provisionalSuffix(r.source) !== null)
      .map((r) => r.id)
      .sort();
    expect(provisional).toEqual(['ml66/P1c', 'ml66/P1f', 'ml66/S2']);

    // 「形状解釈が仮」(K-a/K-b)と「図上範囲が仮」(P1f)は suffix の文章で区別(フラグは共通)
    expect(provisionalSuffix(ML66.regions['ml66/P1c'].source)).toBe(
      '形状解釈(確認(1)待ち)— ML66 Fig.2(デジタイズ・ユーザー同定 2026-06-10)',
    );
    expect(provisionalSuffix(ML66.regions['ml66/P1f'].source)).toBe(
      '図上範囲(独自定義・出典なし)',
    );
    expect(provisionalSuffix(ML66.regions['ml66/S2'].source)).toBe(
      '形状解釈(鱗状差分・確認(5)待ち)— ML66 Fig.2(デジタイズ済)・温度範囲は F8(Weickmann)',
    );
  });
});

// 案 K(CP-K5)カテゴリ語文法のテスト(設計書 §2.1.1 — K2 仕様判定 1 の申し送り)。

describe('案K parseProvisionalSource — カテゴリ語文法(設計書 §2.1.1)', () => {
  it('c. カテゴリ語は 2 語固定(形状解釈 / 図上範囲 — §10.5 語彙を増やさない)', () => {
    expect(PROVISIONAL_CATEGORIES).toEqual(['形状解釈', '図上範囲']);
  });

  it('d. 正常系: 2 カテゴリ語 × 出典あり/なし', () => {
    expect(parseProvisionalSource('provisional: 形状解釈(確認(1)待ち)— ML66 Fig.2(デジタイズ)')).toEqual({
      category: '形状解釈',
      qualifier: '確認(1)待ち',
      citation: 'ML66 Fig.2(デジタイズ)',
    });
    // 出典なし(P1f の実績形)
    expect(parseProvisionalSource('provisional: 図上範囲(独自定義・出典なし)')).toEqual({
      category: '図上範囲',
      qualifier: '独自定義・出典なし',
      citation: null,
    });
    expect(parseProvisionalSource('provisional: 図上範囲(s 値未確定)— MKY71')).toEqual({
      category: '図上範囲',
      qualifier: 's 値未確定',
      citation: 'MKY71',
    });
  });

  it('e. 修飾内の入れ子括弧(確認(6)(7)待ち 等)を深さ計数で正しく扱う', () => {
    // K4 複合行の実績文字列と同形
    expect(
      parseProvisionalSource('provisional: 形状解釈(終端要素・確認(6)(7)待ち)— ML66 §3.4'),
    ).toEqual({
      category: '形状解釈',
      qualifier: '終端要素・確認(6)(7)待ち',
      citation: 'ML66 §3.4',
    });
    // 二重入れ子も釣り合う括弧で終端を決める
    expect(parseProvisionalSource('provisional: 形状解釈(注(内(奥))付き)')).toEqual({
      category: '形状解釈',
      qualifier: '注(内(奥))付き',
      citation: null,
    });
  });

  it('f. 不正系 reject: カテゴリ語外・括弧不整合・空修飾・区切り不正・空出典・非仮', () => {
    // カテゴリ語外(旧 §2.1 例の「差分パラメタ」は文法昇格後は不適合)
    expect(parseProvisionalSource('provisional: 差分パラメタ(確認(5)待ち)')).toBeNull();
    // カテゴリ語のみ(括弧なし)
    expect(parseProvisionalSource('provisional: 形状解釈')).toBeNull();
    // 閉じ括弧不足(入れ子の開きすぎ)
    expect(parseProvisionalSource('provisional: 形状解釈(確認(1待ち)')).toBeNull();
    // 余剰の閉じ括弧(釣り合い後に '— ' 以外が続く)
    expect(parseProvisionalSource('provisional: 形状解釈(確認(1)待ち))')).toBeNull();
    // 空修飾(何が仮かは必須 — §2.1)
    expect(parseProvisionalSource('provisional: 形状解釈()')).toBeNull();
    // 区切り不正(em ダッシュ '— ' 以外の続き)
    expect(parseProvisionalSource('provisional: 形状解釈(確認(1)待ち)ML66')).toBeNull();
    expect(parseProvisionalSource('provisional: 形状解釈(確認(1)待ち) — ML66')).toBeNull();
    // 空出典(区切りだけ置いて出典を書かないのは不適合)
    expect(parseProvisionalSource('provisional: 形状解釈(確認(1)待ち)— ')).toBeNull();
    // 非仮・裸 provisional は suffix 段階で null
    expect(parseProvisionalSource('ML66 Fig.2(デジタイズ済)')).toBeNull();
    expect(parseProvisionalSource('provisional')).toBeNull();
  });

  it('g. 既存 provisional 全行(ML66 regions + COMPOSITE_TABLE)が文法適合する', () => {
    const all = [
      ...Object.values(ML66.regions).map((r) => ({ id: r.id, source: r.source })),
      ...COMPOSITE_TABLE.map((c) => ({ id: c.id, source: c.source })),
    ];
    for (const { id, source } of all) {
      if (provisionalSuffix(source) === null) continue; // 非仮行は対象外
      expect(parseProvisionalSource(source), `${id} が文法不適合: ${source}`).not.toBeNull();
    }
  });

  it('h. カテゴリ判定: P1c/S2/複合 2 行 = 形状解釈、P1f = 図上範囲', () => {
    expect(parseProvisionalSource(ML66.regions['ml66/P1c'].source)?.category).toBe('形状解釈');
    expect(parseProvisionalSource(ML66.regions['ml66/S2'].source)?.category).toBe('形状解釈');
    expect(parseProvisionalSource(ML66.regions['ml66/P1f'].source)?.category).toBe('図上範囲');
    for (const id of ['composite/P2-plate-ends', 'composite/P2-branched-ends']) {
      const entry = COMPOSITE_TABLE.find((c) => c.id === id)!;
      expect(parseProvisionalSource(entry.source)?.category, id).toBe('形状解釈');
    }
  });

  it('i. 手動モード出し分けの導出(d2d7b65 仕様判定 1): 形状解釈を持つ形態 = 広幅枝・鱗状側面のみ', () => {
    // 手動モードのバッジ点灯・セレクト（仮）付与の単一情報源(playground は表を持たない)。
    // 羊歯(P1f)は図上範囲のみ仮 → 手動では消灯(suffix 自体は非 null なので
    // スライダーモードの点灯は維持される — 現状不変)
    const shapeProvisional = [
      ...new Set(
        Object.values(ML66.regions)
          .filter((r) => parseProvisionalSource(r.source)?.category === '形状解釈')
          .map((r) => r.morphology),
      ),
    ].sort();
    expect(shapeProvisional).toEqual(['広幅枝', '鱗状側面']);
    expect(provisionalSuffix(ML66.regions['ml66/P1f'].source)).not.toBeNull(); // スライダー点灯維持
  });
});
