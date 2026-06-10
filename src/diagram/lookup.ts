import type { Morphology } from '../types';
import type { ConditionDiagram, DiagramRegion, MlCode } from './types';
import { waterSaturationExcessDensity } from './saturation';
import { NAKAYA_V1 } from './nakaya-v1';

export interface RegionHit {
  region: DiagramRegion;
  morphology: Morphology;
  mlCode: MlCode | null;
}

/**
 * 条件図上で (T, vapor) を領域に分類する(設計書 §4 の境界規約)。
 *
 * - T は tDomain にクランプし、T ∈ (tMin, tMax] でバンド選択(T=0 は最暖バンド)。
 *   クランプ後の T が tDomain 下端と一致する場合は最寒バンドに所属させる。
 * - vaporCoord='s' のときのみ s = vapor / ρ_ws(T) に変換(T はクランプ後)。
 * - 下から順に 値 ≤ sTop(T) を満たす最初の段。sTop(T) は tMax 端→tMin 端の線形補間。
 *   境界は下側所属(≤、v1 の規約と一致)。最上段は sTop なし=∞。
 *
 * `diagram` の既定値は現状 NAKAYA_V1(実装ステップ2で ML66 既定へ切替予定、設計書 §8)。
 */
export function classifyOnDiagram(
  tempC: number,
  vapor: number,
  diagram: ConditionDiagram = NAKAYA_V1,
): RegionHit {
  const [tMin, tMax] = diagram.tDomain;
  const t = Math.min(Math.max(tempC, tMin), tMax);

  // バンド選択(bands は tMax 降順)。t = tDomain 下端は半開区間に入らないため最寒バンドへ
  const band =
    diagram.bands.find((b) => t <= b.tMax && t > b.tMin) ?? diagram.bands[diagram.bands.length - 1];

  const value = diagram.vaporCoord === 's' ? vapor / waterSaturationExcessDensity(t) : vapor;

  // 下から順に走査。sTop なし(=∞)の段は常に該当
  let chosen = band.stack[band.stack.length - 1];
  for (const entry of band.stack) {
    if (entry.sTop === undefined) {
      chosen = entry;
      break;
    }
    const [atTMax, atTMin] = entry.sTop;
    const f = (band.tMax - t) / (band.tMax - band.tMin); // tMax端で0 → tMin端で1
    if (value <= atTMax + (atTMin - atTMax) * f) {
      chosen = entry;
      break;
    }
  }

  const region = diagram.regions[chosen.regionId];
  if (!region) {
    throw new Error(`classifyOnDiagram: unknown regionId '${chosen.regionId}' in '${diagram.id}'`);
  }
  return { region, morphology: region.morphology, mlCode: region.mlCode };
}
