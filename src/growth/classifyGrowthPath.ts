import { classifyOnDiagram } from '../diagram/lookup';
import { REGION_CLASS } from './regionClasses';
import { COMPOSITE_TABLE } from './composites';
import type { GrowthPath, PathHit } from './types';

/**
 * 成長パス(環境条件の列)を分類する(設計書 §3)。
 *
 * - MVP(3a)は 2 ステージ固定: path.length !== 2 は明示 throw。
 * - 各ステージを classifyOnDiagram(既定 = ML66)で単独分類し、REGION_CLASS で
 *   from / to をクラス化して COMPOSITE_TABLE と照合する。該当なし = composite null
 *   (描画は最終ステージの形態)。polycrystal を含むペアは表に無いため自然に null。
 *
 * 注: 3a 内部 API・ML66 専用。公開面(src/index.ts)への追加は 0.3.0 で判断。
 */
export function classifyGrowthPath(path: GrowthPath): PathHit {
  if (path.length !== 2) {
    throw new Error(
      `classifyGrowthPath: MVP (3a) requires a 2-stage path (length === 2), got ${path.length}`,
    );
  }
  const stages = path.map((stage) =>
    classifyOnDiagram(stage.temperature, stage.supersaturation),
  );
  const from = REGION_CLASS[stages[0].region.id];
  const to = REGION_CLASS[stages[1].region.id];
  const composite = COMPOSITE_TABLE.find((e) => e.from === from && e.to === to) ?? null;
  return { stages, composite };
}
