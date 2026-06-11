import { THREE } from '../three';
import { COLORS } from '../classify';
import { createSnowCrystal } from '../createSnowCrystal';
import {
  createBranchWithChildren,
  createElongatedHexPrism,
  type DendriteArmOptions,
} from '../geometry/parts';
import type { Morphology } from '../types';
import type { CompositeMorphology } from './types';

// P2 系複合(角板付枝 P2a/P2c・枝付角板 P2f/P2g)の外付けアタッチメント合成層
// (案 K 設計書 §10.2 案 B)。中核 = buildMorphology 既定経路の出力 Group を
// 無改変のまま子に取り(包含のみ・1 ビットも触らない — フルメッシュ署名テストで
// 機械証明)、終端部品 ×6 を兄弟として外付けする。
// 3a 内部 API — src/index.ts には export しない(growth 非公開層)。

/**
 * 終端アタッチ半径 r_attach の採用値表(§10.2)。終端 6 方位は全中核で
 * φ_k = 30° + k·60°(Cylinder 族 R2)・y = 0 の単一規則。
 * 値は各ビルダーの採用定数のコピーで、出所をコメントに記す
 * (annotations の「表示専用コピー」と同性格 — 単形態ビルダーに複合知識を
 * 持ち込まない案 B の責務分離)。
 * 定義域 = REGION_CLASS の branched 5 形態 ∪ plate 3 形態の計 8 形態。
 * 表に無い中核(needle-column / polycrystal の 7 形態)は throw(防御的エラー —
 * HexOutlineBuilder の検証規約と同流儀。対応表拡張時に黙って誤配置しないため)。
 */
export const TIP_ATTACH_RADIUS: Partial<Record<Morphology, number>> = {
  // 樹枝族: DENDRITE_ARM_DEFAULTS.mainLength(腕先端)
  '樹枝状': 2.1,
  '星状': 2.1,
  '羊歯': 2.1,
  // 扇形族: SECTOR_PETAL_DEFAULTS の baseRadius 0.42 + petalLength 1.1(花弁先端)
  '扇形': 1.52,
  '広幅枝': 1.52,
  // plate 系: 各 case の外接半径
  '角板': 0.72, // 中心 wing 柱 0.6 × 1.2(外接頂点)
  '厚角板': 0.6, // CylinderGeometry 外接半径
  '骸晶角板': 0.6, // 最外層外接半径
};

/**
 * 小六角板(P2a/P2c の終端)。CylinderGeometry(…, 6) の頂点方位は 30°+k·60° で、
 * rotation.y = 0 のまま radial 整合(−φ_k + 30° ≡ 0 (mod 60°) — 針の Θ0 計算と同値)。
 * 中心 = φ_k 方位・半径 r_attach + radius − embed・y = 0(§10.2)。
 */
export const TIP_PLATE_PARAMS = { radius: 0.35, thickness: 0.1, embed: 0.05 } as const;

/**
 * 扇形花弁(P2f の終端)= 扇形族の花弁(SECTOR_PETAL_DEFAULTS 0.5/1.1)の
 * スケール s = 0.6・厚み 0.1 据え置き(花弁長 0.66・幅 0.30)。
 * 基部頂点 = φ_k 方位・半径 r_attach − embed、rotation は扇形族と同式(§10.2)。
 */
export const TIP_PETAL_PARAMS = { scale: 0.6, thickness: 0.1, embed: 0.02 } as const;

/**
 * 樹枝腕(P2g の終端)の腕パラメタ(§10.2)。未指定の幅・厚みは
 * DENDRITE_ARM_DEFAULTS のデフォルトマージ(既存ビルダーの規約)。
 * 腕グループを φ_k へ回転し、原点を半径 r_attach − embed へ平行移動する。
 * embed は扇形花弁と同値 0.02(基部頂点埋め込みの同型 — 「接合部は埋め込み」の流儀)。
 */
export const TIP_ARM_PARAMS: DendriteArmOptions = {
  mainLength: 1.2,
  mainWidth: 0.08,
  sideCount: 2,
  sideSpacing: 0.35,
  sideStart: 1.2,
  sideLength: 0.4,
};
export const TIP_ARM_EMBED = 0.02;

/** 配下の全 Mesh に userData.part を付与(冠柱の 'column' | 'cap' 前例 — §10.2)。 */
function tagPart(root: THREE.Object3D, part: 'core' | 'tip'): void {
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.userData.part = part;
    }
  });
}

/** 小六角板の終端部品(P2a/P2c)。 */
function buildPlateTip(rAttach: number, phi: number): THREE.Mesh {
  const { radius, thickness, embed } = TIP_PLATE_PARAMS;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, thickness, 6),
    new THREE.MeshStandardMaterial({ color: COLORS.base, flatShading: true }),
  );
  const r = rAttach + radius - embed;
  mesh.position.set(r * Math.cos(phi), 0, r * Math.sin(phi));
  // rotation.y = 0 のまま(頂点方位 30°+k·60° が radial に整合 — TIP_PLATE_PARAMS コメント)
  return mesh;
}

/** 扇形花弁の終端部品(P2f)。配置式は buildSectorFamily の花弁と同式。 */
function buildPetalTip(rAttach: number, phi: number): THREE.Mesh {
  const { scale, thickness, embed } = TIP_PETAL_PARAMS;
  const petal = createElongatedHexPrism(0.5 * scale, 1.1 * scale, thickness);
  petal.rotation.x = Math.PI / 2; // XZ 平面に寝かせ(厚み中心 y = 0)
  petal.rotation.z = phi - Math.PI / 2; // 長軸 +Y → (cosφ, 0, sinφ)
  const r = rAttach - embed;
  petal.position.set(r * Math.cos(phi), 0, r * Math.sin(phi));
  return petal;
}

/** 樹枝腕の終端部品(P2g)。腕先端方位 = 90° + angleRad のため angleRad = φ_k − 90°。 */
function buildArmTip(rAttach: number, phi: number): THREE.Group {
  const arm = createBranchWithChildren(phi - Math.PI / 2, TIP_ARM_PARAMS);
  const r = rAttach - TIP_ARM_EMBED;
  arm.position.set(r * Math.cos(phi), 0, r * Math.sin(phi));
  return arm;
}

/** ②形態 → 終端部品の選択(§10.2): 扇形族 → 扇形花弁 / 樹枝族 → 樹枝腕。 */
function buildBranchedTip(tipMorphology: Morphology, rAttach: number, phi: number): THREE.Object3D {
  switch (tipMorphology) {
    case '扇形':
    case '広幅枝':
      return buildPetalTip(rAttach, phi);
    case '樹枝状':
    case '星状':
    case '羊歯':
      return buildArmTip(rAttach, phi);
    default:
      throw new Error(
        `createTipComposite: tip morphology '${tipMorphology}' is not a branched-class form (扇形族・樹枝族)`,
      );
  }
}

/**
 * P2 系複合(終端要素コンポジット)を組み立てる(案 K 設計書 §10.2)。
 *
 * - '角板付枝'(P2a/P2c): 中核 = ①の branched 形態 + 小六角板 ×6。
 * - '枝付角板'(P2f/P2g): 中核 = ①の plate 形態 + ②の形態で選ぶ終端枝 ×6。
 * - children = [core(Group), tip×6] の固定順。core 配下の全 Mesh に
 *   userData.part = 'core'、終端部品の全 Mesh に 'tip'(冠柱の part 値は改名しない)。
 * - 中核は createSnowCrystal({ morphology, seed }) の戻り値そのもの
 *   (= buildMorphology(morphology, mulberry32(seed ?? 1)) — DEFAULT_SEED 1 を含め
 *   現行の委譲経路と完全に同一。無改変包含 = §10.2 案 B)。
 * - 終端部品はシード乱数を消費しない(規則形)。
 * - 中核が r_attach 表(branched 5 ∪ plate 3)に無い形態のときは throw。
 */
export function createTipComposite(
  morphology: Exclude<CompositeMorphology, '冠柱'>,
  coreMorphology: Morphology,
  tipMorphology: Morphology,
  seed?: number,
): THREE.Group {
  const rAttach = TIP_ATTACH_RADIUS[coreMorphology];
  if (rAttach === undefined) {
    throw new Error(
      `createTipComposite: core morphology '${coreMorphology}' is outside the attach-radius table ` +
        '(branched 5 ∪ plate 3 — 案 K 設計書 §10.2)',
    );
  }

  const group = new THREE.Group();

  const core = createSnowCrystal({ morphology: coreMorphology, seed });
  tagPart(core, 'core');
  group.add(core);

  for (let k = 0; k < 6; k++) {
    const phi = Math.PI / 6 + (k * Math.PI) / 3; // φ_k = 30° + k·60°(Cylinder 族 R2)
    const tip =
      morphology === '角板付枝'
        ? buildPlateTip(rAttach, phi)
        : buildBranchedTip(tipMorphology, rAttach, phi);
    tagPart(tip, 'tip');
    group.add(tip);
  }

  return group;
}
