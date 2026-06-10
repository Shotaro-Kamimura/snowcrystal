import { THREE } from '../three';
import { createSnowCrystal } from '../createSnowCrystal';
import { classifyGrowthPath } from './classifyGrowthPath';
import { createCappedColumn } from './cappedColumn';
import type { GrowthPath } from './types';

/**
 * 成長パスの描画入口(設計書 §6)。
 *
 * classifyGrowthPath(path) で PathHit を解決し、
 * - composite.morphology === '冠柱' → 専用ジオメトリ createCappedColumn
 * - それ以外(null・classification-only)→ 最終ステージの RegionHit.morphology で
 *   createSnowCrystal に委譲(createSnowCrystal 自体は不変)
 *
 * 戻り group の userData.pathHit に PathHit を格納する(playground 情報パネル用)。
 * 3a 内部 API — src/index.ts には export しない(公開面への追加は 0.3.0 で判断)。
 */
export function renderGrowthPath(path: GrowthPath, seed?: number): THREE.Group {
  const pathHit = classifyGrowthPath(path);
  const group =
    pathHit.composite?.morphology === '冠柱'
      ? createCappedColumn(seed)
      : createSnowCrystal({
          morphology: pathHit.stages[pathHit.stages.length - 1].morphology,
          seed,
        });
  group.userData.pathHit = pathHit;
  return group;
}
