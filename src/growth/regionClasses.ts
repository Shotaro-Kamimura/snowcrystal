import type { RegionClass } from './types';

/**
 * regionId → RegionClass の対応表(設計書 §3)。ML66.regions の全 id を網羅
 * (過不足はテストで担保)。割当基準は labelJa:
 *   needle-column: 針・さや・長柱・角柱・骸晶角柱
 *   plate:         角板・厚角板・骸晶角板
 *   branched:      扇形・広幅枝・星状・樹枝状・羊歯
 *   polycrystal:   砲弾集合・側面(MVP の複合対応表では from/to に使わない)
 */
export const REGION_CLASS: Record<string, RegionClass> = {
  // needle-column
  'ml66/N1a': 'needle-column', // 針
  'ml66/N1c': 'needle-column', // さや
  'ml66/N1e': 'needle-column', // 長柱
  'ml66/C1e': 'needle-column', // 角柱
  'ml66/C1f': 'needle-column', // 骸晶角柱
  // plate
  'ml66/P1a': 'plate', // 角板
  'ml66/P1a-warm': 'plate', // 角板(0〜−4°C、Kobayashi 補外)
  'ml66/C1g': 'plate', // 厚角板
  'ml66/C1h': 'plate', // 骸晶角板
  // branched
  'ml66/P1b': 'branched', // 扇形
  'ml66/P1c': 'branched', // 広幅枝
  'ml66/P1d': 'branched', // 星状
  'ml66/P1e': 'branched', // 樹枝状
  'ml66/P1f': 'branched', // 羊歯
  // polycrystal
  'ml66/C2a': 'polycrystal', // 砲弾集合
  'ml66/S1': 'polycrystal', // 側面
  'ml66/S2': 'polycrystal', // 側面(S2 approx)
};
