import type { RegionHit } from '../diagram/lookup';
import type { MlCode } from '../diagram/types';

// Phase 3a の成長パス(環境履歴)データモデル。THREE 非依存。
// docs/phase3-growth-path-design.md §3 をそのまま定義。
// 3a 内部 API — src/index.ts には export しない(公開面への追加は 0.3.0 で判断)。

export interface GrowthStage {
  temperature: number; // °C(条件図と同じ)
  supersaturation: number; // 公開縦軸 0–0.3(条件図と同じ)
}

/**
 * 規約: stages[0] = 最初の成長 = 結晶の中心部、最後 = 外周。
 * ML66 Fig.2 の遷移矢印(始点 → 終点)と同じ向き。MVP は length === 2 を要求。
 */
export type GrowthPath = readonly GrowthStage[];

export type RegionClass = 'needle-column' | 'plate' | 'branched' | 'polycrystal';

/**
 * 複合型専用の形態キー。Morphology union には追加しない
 * (0.2.0 凍結中に公開 union の変更を積まないため。統合は 0.3.0 で判断)。
 */
export type CompositeMorphology = '冠柱';

export interface CompositeEntry {
  id: string; // 'composite/CP1a'
  mlCode: MlCode; // 'CP1a'
  labelJa: string; // '冠柱'
  from: RegionClass;
  to: RegionClass;
  morphology: CompositeMorphology | null; // 専用ジオメトリあり | null = 分類のみ
  fidelity: 'exact' | 'approx'; // DiagramRegion と同語彙
  source: string;
  confidence: 'high' | 'mid' | 'low';
}

export interface PathHit {
  stages: RegionHit[]; // classifyOnDiagram(既定 ML66)を各ステージに適用
  composite: CompositeEntry | null; // 対応表に該当なし = null(描画は最終ステージの形態)
}
