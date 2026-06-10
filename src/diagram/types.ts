import type { Morphology } from '../types';

// 条件図(condition diagram)のスキーマ。THREE 非依存。
// docs/phase2-ml66-diagram-design.md §3 をそのまま定義したもの。

export type DiagramId = 'nakaya-v1' | 'ml66';

/** ML66 のタイプコード(N1a, C1c, P1e, S1 など)。Kikuchi グローバル分類とは別名前空間(設計書 §6) */
export type MlCode = string;

export interface DiagramRegion {
  id: string; // 'ml66/P1e' のように diagram を前置
  mlCode: MlCode | null; // 出典コード(nakaya-v1 では null)
  morphology: Morphology; // 描画キー
  fidelity: 'exact' | 'approx'; // mlCode と描画形態の一致度
  labelJa: string; // 図面ラベル(例 '樹枝状')
  source: string; // 'ML66 §3.1' | 'ML66 Fig.2(デジタイズ)' | 'MKY71' | 'provisional'
  confidence: 'high' | 'mid' | 'low';
}

/**
 * バンド内の縦積み1段。sTop は [tMax(高温端)での上限, tMin(低温端)での上限]
 * (T について区間線形)。最上段は省略=∞。
 */
export interface StackEntry {
  regionId: string;
  sTop?: readonly [number, number];
}

/** 温度バンド。T ∈ (tMin, tMax](getCrystalType の半開区間規約と同じ向き) */
export interface TemperatureBand {
  tMax: number;
  tMin: number;
  stack: readonly StackEntry[];
}

export interface ConditionDiagram {
  id: DiagramId;
  vaporCoord: 'rho' | 's'; // nakaya-v1 は 'rho'(現行しきい値の忠実移植)、ml66 は 's'
  tDomain: readonly [number, number]; // [-40, 0]
  rhoDomain: readonly [number, number]; // [0, 0.3]
  regions: Readonly<Record<string, DiagramRegion>>;
  bands: readonly TemperatureBand[]; // tMax 降順・隙間なく tDomain を被覆
}
