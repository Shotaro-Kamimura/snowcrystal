import { THREE } from '../three';
import { createSnowCrystal } from '../createSnowCrystal';
import { classifyGrowthPath } from './classifyGrowthPath';
import { createCappedColumn } from './cappedColumn';
import { createTipComposite } from './tipComposites';
import type { GrowthPath } from './types';

/**
 * 成長パスの描画入口(設計書 §6・案 K 設計書 §10)。
 *
 * classifyGrowthPath(path) で PathHit を解決し、composite.morphology で分岐:
 * - '冠柱' → 専用ジオメトリ createCappedColumn
 * - '角板付枝' | '枝付角板' → 終端要素コンポジット createTipComposite
 *   (中核 = stages[0]・終端種別 = stages[1] — ①が星状なら P2a・樹枝状なら
 *   P2c の区別が自動で出る §10.2)
 * - それ以外(null・classification-only)→ 最終ステージの RegionHit.morphology で
 *   createSnowCrystal に委譲(createSnowCrystal 自体は不変)
 *
 * 戻り group の userData.pathHit に PathHit を格納する(playground 情報パネル用)。
 * 3a 内部 API — src/index.ts には export しない(公開面への追加は 0.3.0 で判断)。
 */
export function renderGrowthPath(path: GrowthPath, seed?: number): THREE.Group {
  const pathHit = classifyGrowthPath(path);
  const morphology = pathHit.composite?.morphology ?? null;
  let group: THREE.Group;
  switch (morphology) {
    case '冠柱':
      group = createCappedColumn(seed);
      break;
    case '角板付枝':
    case '枝付角板':
      group = createTipComposite(
        morphology,
        pathHit.stages[0].morphology,
        pathHit.stages[1].morphology,
        seed,
      );
      break;
    default:
      group = createSnowCrystal({
        morphology: pathHit.stages[pathHit.stages.length - 1].morphology,
        seed,
      });
  }
  group.userData.pathHit = pathHit;
  return group;
}
