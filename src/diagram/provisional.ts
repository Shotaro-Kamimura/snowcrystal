// 仮実装(provisional)マーキングのデータ層規約(案 K 設計書 §2.1)。
// 機械可読の仮フラグは DiagramRegion.source / CompositeEntry.source の
// 接頭辞 'provisional: ' 1 本で、後続の自由文が「何が仮か」を述べる。
// UI 層(playground のバッジ)はこのパーサで導出し、仮形態のハードコード表を
// 持たない(単一情報源)。案 K 内部 API — src/index.ts には export しない
// (d.ts 不変。playground からは深い import — growth・hexOutlineBuilder の前例)。

/** 仮フラグの接頭辞(この文字列で始まる source のみが機械可読の「仮」)。 */
export const PROVISIONAL_PREFIX = 'provisional: ';

/**
 * source 文字列から「何が仮か」(接頭辞の後続文)を取り出す。
 * 仮でない source、および旧規約の裸 'provisional'(接頭辞なし — CP-K2 で
 * 正規化済み)には null を返す。空 suffix も規約違反として null
 * (接頭辞の後ろには必ず仮の対象を書く — 設計書 §2.1)。
 */
export function provisionalSuffix(source: string): string | null {
  if (!source.startsWith(PROVISIONAL_PREFIX)) return null;
  const suffix = source.slice(PROVISIONAL_PREFIX.length);
  return suffix.length > 0 ? suffix : null;
}

// ─────────────────────────────────────────────────────────────────────────
// カテゴリ語文法(CP-K5 で正式昇格 — K2 仕様判定 1 の申し送り・設計書 §2.1.1)。
//
//   provisional-source ::= 'provisional: ' カテゴリ語 '(' 修飾 ')' ( '— ' 出典 )?
//   カテゴリ語          ::= '形状解釈' | '図上範囲'
//   修飾                ::= 非空・括弧バランスの取れた文字列(入れ子可)
//   出典                ::= 非空文字列(オプショナル — P1f は出典なし)
//
// カテゴリ語は 2 語固定(設計書 §10.5 — 語彙を増やさない)。修飾内の入れ子括弧
// (例: '終端要素・確認(6)(7)待ち')は深さ計数でバランスさせ、修飾の終端 ')' は
// カテゴリ語直後の '(' と釣り合う括弧とする。出典区切り '— '(em ダッシュ U+2014
// +空白)はその直後に置く(P1c・複合行の実績文字列と同形)。
// ─────────────────────────────────────────────────────────────────────────

/** 仮の対象カテゴリ語(2 語固定 — 設計書 §10.5)。 */
export const PROVISIONAL_CATEGORIES = ['形状解釈', '図上範囲'] as const;

export type ProvisionalCategory = (typeof PROVISIONAL_CATEGORIES)[number];

/** 文法準拠の provisional source のパース結果。 */
export interface ProvisionalParts {
  /** 何が仮かの種別(形状解釈 = 描画形状が仮 / 図上範囲 = 領域の図上範囲が仮) */
  category: ProvisionalCategory;
  /** 修飾(カテゴリ語直後の括弧内。連動確認番号などの補足 — 非空) */
  qualifier: string;
  /** 出典(任意。'— ' 区切りの後続文 — 既存出典の続記など) */
  citation: string | null;
}

/** 出典区切り(修飾の閉じ括弧直後に置く)。 */
const CITATION_SEPARATOR = '— ';

/**
 * source 文字列をカテゴリ語文法(上記 BNF)で機械パースする。
 * 文法に合致しない source(非仮・カテゴリ語外・括弧不整合・空修飾・
 * 区切り不正・空出典)には null を返す。
 * UI 層の出し分け(手動モードのバッジ点灯 = category が '形状解釈' の場合のみ —
 * d2d7b65 仕様判定 1)はこのパーサで導出し、playground 側に表を持たない。
 */
export function parseProvisionalSource(source: string): ProvisionalParts | null {
  const suffix = provisionalSuffix(source);
  if (suffix === null) return null;

  const category = PROVISIONAL_CATEGORIES.find((c) => suffix.startsWith(`${c}(`));
  if (category === undefined) return null;

  // 修飾の終端 = カテゴリ語直後の '(' と釣り合う ')'(入れ子は深さ計数)
  let depth = 0;
  let close = -1;
  for (let i = category.length; i < suffix.length; i++) {
    if (suffix[i] === '(') depth++;
    else if (suffix[i] === ')') {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) return null; // 閉じ括弧不足(括弧不整合)

  const qualifier = suffix.slice(category.length + 1, close);
  if (qualifier.length === 0) return null; // 修飾は必須(何が仮かを書く — §2.1)

  const rest = suffix.slice(close + 1);
  if (rest === '') return { category, qualifier, citation: null };
  if (!rest.startsWith(CITATION_SEPARATOR)) return null; // 区切り不正(余剰 ')' を含む)
  const citation = rest.slice(CITATION_SEPARATOR.length);
  return citation.length > 0 ? { category, qualifier, citation } : null;
}
