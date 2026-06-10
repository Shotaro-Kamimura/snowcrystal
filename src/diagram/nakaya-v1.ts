import type { Morphology } from '../types';
import type { ConditionDiagram, DiagramRegion } from './types';

// 現行 getCrystalType(v1)の if-else しきい値の忠実データ化(設計書 §8)。
// 挙動の単一情報源・回帰テスト対象・学会での v1/v2 説明用。
// vaporCoord が 'rho' のため、sTop の数値は過剰水蒸気密度 ρ [g/m³] のしきい値そのもの。

function region(morphology: Morphology): DiagramRegion {
  return {
    id: `nakaya-v1/${morphology}`,
    mlCode: null,
    morphology,
    fidelity: 'exact',
    labelJa: morphology,
    source: 'v1 getCrystalType',
    confidence: 'high',
  };
}

const MORPHOLOGIES = [
  '角板',
  '角柱',
  '骸晶角柱',
  'さや',
  '針',
  '厚角板',
  '骸晶角板',
  '扇形',
  '樹枝状',
] as const;

const REGIONS: Readonly<Record<string, DiagramRegion>> = Object.fromEntries(
  MORPHOLOGIES.map((m) => [`nakaya-v1/${m}`, region(m)]),
);

export const NAKAYA_V1: ConditionDiagram = {
  id: 'nakaya-v1',
  vaporCoord: 'rho',
  tDomain: [-40, 0],
  rhoDomain: [0, 0.3],
  regions: REGIONS,
  bands: [
    // (−4, 0]: 角板(全域)。v1 では vapor < 0.1 が fallback '角板' に落ちるため実質全域が角板
    { tMax: 0, tMin: -4, stack: [{ regionId: 'nakaya-v1/角板' }] },
    {
      tMax: -4,
      tMin: -10,
      stack: [
        { regionId: 'nakaya-v1/角柱', sTop: [0.05, 0.05] },
        { regionId: 'nakaya-v1/骸晶角柱', sTop: [0.1, 0.1] },
        { regionId: 'nakaya-v1/さや', sTop: [0.15, 0.15] },
        { regionId: 'nakaya-v1/針' },
      ],
    },
    {
      tMax: -10,
      tMin: -22,
      stack: [
        { regionId: 'nakaya-v1/厚角板', sTop: [0.05, 0.05] },
        { regionId: 'nakaya-v1/骸晶角板', sTop: [0.15, 0.15] },
        { regionId: 'nakaya-v1/扇形', sTop: [0.2, 0.2] },
        { regionId: 'nakaya-v1/樹枝状' },
      ],
    },
    {
      tMax: -22,
      tMin: -40,
      stack: [
        { regionId: 'nakaya-v1/角柱', sTop: [0.05, 0.05] },
        { regionId: 'nakaya-v1/骸晶角柱', sTop: [0.1, 0.1] },
        { regionId: 'nakaya-v1/さや' },
      ],
    },
  ],
};
