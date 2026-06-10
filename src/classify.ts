import type { Morphology } from './types';
import { classifyOnDiagram } from './diagram/lookup';
import { ML66 } from './diagram/ml66';

/** Shared palette (ported verbatim from the snownotes viewer). */
export const COLORS = {
  base: 0xcccccc, // 白寄りのグレー
  highlight: 0xffffff, // ピュアホワイト
  edge: 0x888888, // やや暗いグレー
  wing: 0xaaaaaa, // 羽や針も白系で統一
} as const;

export const TITLE_MAP: Record<Morphology, { ja: string; en: string }> = {
  針: { ja: '針', en: 'Needle' },
  さや: { ja: 'さや', en: 'Sheath' },
  角柱: { ja: '角柱', en: 'Column' },
  骸晶角柱: { ja: '骸晶角柱', en: 'Skeleton Column' },
  角板: { ja: '角板', en: 'Plate' },
  厚角板: { ja: '厚角板', en: 'Thick Solid Plate' },
  骸晶角板: { ja: '骸晶角板', en: 'Skeleton Plate' },
  扇形: { ja: '扇形', en: 'Sector' },
  樹枝状: { ja: '樹枝状', en: 'Dendrite' },
  砲弾集合: { ja: '砲弾集合', en: 'Combination of Bullets' },
  側面: { ja: '側面', en: 'Side Planes' },
};

/** Short subtype lists keyed by global-classification code. */
export const SUBTYPE_MAP: Record<string, string[]> = {
  C1a: ['C1a - 針', 'C1b - 束状針', 'C1c - 針集合'],
  C2a: ['C2a - さや', 'C2b - 束状さや'],
  C3a: ['C3a - 角柱', 'C3b - 骸晶角柱'],
  P1a: ['P1a - 角板', 'P1b - 厚角板', 'P1c - 骸晶角板'],
  P4f: ['P4f - 扇付角板'],
  P4g: ['P4g - 樹枝付角板'],
};

/** Full bilingual subtype lists keyed by global-classification code. */
export const FULL_SUBTYPE_MAP: Record<string, string[]> = {
  C1a: [
    'C - 柱状結晶群 - Column crystal group',
    'C1 - 針状結晶 - Needle-type crystal',
    'C1a - 針 - Needle',
    'C1b - 束状針 - Bundle of needles',
    'C1c - 針集合 - Combination of needles',
  ],
  C2a: [
    'C - 柱状結晶群 - Column crystal group',
    'C2 - 鞘状結晶 - Sheath-type crystal',
    'C2a - 鞘 - Sheath',
    'C2b - 束状鞘 - Bundle of sheaths',
    'C2c - 鞘集合 - Combination of sheaths',
  ],
  C3a: [
    'C - 柱状結晶群 - Column crystal group',
    'C3 - 角柱状結晶 - Column-type crystal',
    'C3a - 角柱 - Solid column',
    'C3b - 骸晶角柱 - Skeletal column',
    'C3c - 巻込骸晶角柱 - Skeletal column with scrolls',
  ],
  C3b: [
    'C - 柱状結晶群 - Column crystal group',
    'C3 - 角柱状結晶 - Column-type crystal',
    'C3a - 角柱 - Solid column',
    'C3b - 骸晶角柱 - Skeletal column',
    'C3c - 巻込骸晶角柱 - Skeletal column with scrolls',
  ],
  P1a: [
    'P - 板状結晶群 - Plane crystal group',
    'P1 - 角板状結晶 - Plate-type crystal',
    'P1a - 角板 - Plate',
    'P1b - 厚角板 - Thick solid plate',
    'P1c - 骸晶角板 - Skeletal plate',
  ],
  P1b: [
    'P - 板状結晶群 - Plane crystal group',
    'P1 - 角板状結晶 - Plate-type crystal',
    'P1a - 角板 - Plate',
    'P1b - 厚角板 - Thick solid plate',
    'P1c - 骸晶角板 - Skeletal plate',
  ],
  P1c: [
    'P - 板状結晶群 - Plane crystal group',
    'P1 - 角板状結晶 - Plate-type crystal',
    'P1a - 角板 - Plate',
    'P1b - 厚角板 - Thick solid plate',
    'P1c - 骸晶角板 - Skeletal plate',
  ],
  P4f: [
    'P - 板状結晶群 - Plane crystal group',
    'P4 - 複合板状結晶 - Composite plane-type crystal',
    'P4a - 角板付六花 - Stellar with plates',
    'P4b - 扇付六花 - Stellar with sectors',
    'P4c - 角板付樹枝 - Dendrite with plates',
    'P4d - 扇付樹枝 - Dendrite with sectors',
    'P4e - 枝付角板 - Plate with branches',
    'P4f - 扇付角板 - Plate with sectors',
    'P4g - 樹枝付角板 - Plate with dendrites',
  ],
  P4g: [
    'P - 板状結晶群 - Plane crystal group',
    'P4 - 複合板状結晶 - Composite plane-type crystal',
    'P4a - 角板付六花 - Stellar with plates',
    'P4b - 扇付六花 - Stellar with sectors',
    'P4c - 角板付樹枝 - Dendrite with plates',
    'P4d - 扇付樹枝 - Dendrite with sectors',
    'P4e - 枝付角板 - Plate with branches',
    'P4f - 扇付角板 - Plate with sectors',
    'P4g - 樹枝付角板 - Plate with dendrites',
  ],
};

/**
 * Map a condition-diagram point (temperature °C, vapor 0–0.3 [g/m³]) to a morphology.
 * Temperatures are expected as negative values (e.g. -10 means -10°C).
 * v2: 既定の条件図は Magono & Lee (1966) Fig.2 由来の ML66(設計書 §8)。
 * v1(Nakaya しきい値)の挙動が必要な場合は classifyOnDiagram(temp, vapor, NAKAYA_V1) を明示。
 * 注: T は tDomain [-40, 0] にクランプされる(域外はスライダー範囲外のみの意図的変更)。
 */
export function getCrystalType(temp: number, vapor: number): Morphology {
  return classifyOnDiagram(temp, vapor, ML66).morphology;
}

/**
 * Morphology name -> global-classification subtype code.
 * 砲弾集合・側面はグローバル分類(菊地ほか 2012)のコード未割当のため ''
 * (専門家確認事項(4)、docs/phase2-ml66-diagram-design.md §13)。
 */
export function getSubtypeCode(typeName: Morphology | '' | undefined): string {
  if (!typeName) return '';
  if (typeName === '針') return 'C1a';
  if (typeName === 'さや') return 'C2a';
  if (typeName === '角柱') return 'C3a';
  if (typeName === '骸晶角柱') return 'C3b';
  if (typeName === '角板') return 'P1a';
  if (typeName === '厚角板') return 'P1b';
  if (typeName === '骸晶角板') return 'P1c';
  if (typeName === '扇形') return 'P4f';
  if (typeName === '樹枝状') return 'P4g';
  return '';
}

/**
 * Morphology name -> global-classification label shown in the UI.
 * 砲弾集合・側面はグローバル分類コード未割当のため ''(専門家確認事項(4))。
 */
export function getGlobalLabel(typeName: Morphology): string {
  switch (typeName) {
    case '針':
      return 'C1a';
    case 'さや':
      return 'C2a';
    case '角柱':
      return 'C3a';
    case '骸晶角柱':
      return 'C3b';
    case '角板':
      return 'P1a';
    case '厚角板':
      return 'P1b';
    case '骸晶角板':
      return 'P1c';
    case '扇形':
      return 'P4f';
    case '樹枝状':
      return 'P4g';
    case '砲弾集合':
    case '側面':
      return ''; // グローバル分類コード未割当(専門家確認事項(4))
    default:
      return '';
  }
}
