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
