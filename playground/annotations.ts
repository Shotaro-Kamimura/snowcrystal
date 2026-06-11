// ─────────────────────────────────────────────────────────────────────────
// 結晶学注記レイヤーのデータ表(案 N 設計書 §3・§4.3)。
//
// LABELS と同じ「表示専用の最小コピー」方針: 包絡定数・断面寸法は src の採用値の
// コピーであり、src/ は変更しない。配置はメッシュ内部の走査に依存せず、方位規約
// R1〜R7(設計書 §2.1)+ 本表の定数から計算する。
//
// 族位相(設計書 §2.2 F1):
//   Cylinder 族 = 角頂点 30° + k·60°(R2) / builder 族(案 B 花形)= 0° + k·60°(R3)。
//   さや・針は両族混在だが、注記は花形断面の主柱(さや = 最外層 / 針 = 中心柱、
//   いずれも builder 族 0°)を正とする(裁量 1)。
//
// シード依存の例外 2 形態(砲弾集合 R6・側面 R7)は、createSnowCrystal の既定
// シードと同じ純関数列(mulberry32 → sample*)を再生して代表要素の方位を得る
// (走査でなく規約と決定性からの計算 — 裁量 3)。
// ─────────────────────────────────────────────────────────────────────────
import type { Morphology } from '../src/index';
import { mulberry32 } from '../src/random'; // 深い import(表示専用・src 不変。main.ts の growth と同じ扱い)
import { sampleRosetteAxes } from '../src/geometry/rosette';
import { sampleSidePlaneLayout } from '../src/geometry/parts';
import {
  CSL_TWIN_ANGLE_DEG,
  ICE_C_OVER_A,
  PYRAMID_FACE_ANGLE_FROM_AXIS_RAD,
} from '../src/geometry/crystallography';

export { CSL_TWIN_ANGLE_DEG, ICE_C_OVER_A, PYRAMID_FACE_ANGLE_FROM_AXIS_RAD };

/** Cylinder 族の a 軸位相 [rad](R2: 角頂点 30° + k·60°)。 */
export const CYLINDER_PHASE = Math.PI / 6;

/** builder 族の a 軸位相 [rad](R3: 角頂点 0° + k·60°)。例外 2 形態も基準値 0。 */
export const BUILDER_PHASE = 0;

/** ラベル文言(既存パネルに合わせ 日本語 / English の 2 行)。 */
export interface BilingualText {
  ja: string;
  en: string;
}

/** 角度弧 1 本。deg は表示値(±60 は副枝の左右)、kind は描画ディスパッチキー。 */
export interface ArcSpec {
  deg: number;
  kind: 'interior' | 'reflex' | 'sideBranch' | 'pyramid' | 'dihedral';
}

export interface AnnotationSpec {
  /** a 軸 60° 系列の位相 [rad]。0(builder)| π/6(Cylinder)のみ(テストで固定) */
  phaseRad: number;
  /** 包絡定数(水平半径・全高)— 矢印長の基準。src 採用値からの表示用コピー */
  envelope: { radius: number; height: number };
  /** 軸注記: standard = c+a 3 本 / rosette = 代表 1 腕の c のみ(R6) / spine = a 軸 ∥ +Y(R7) */
  axes: 'standard' | 'rosette' | 'spine';
  /** 120°/240° 弧・面ラベルを置く六角断面(外接半径・端面の y)。standard のみ */
  hexSection?: { radius: number; y: number };
  /** 240° 弧用の花形断面パラメタ(DENT_DIMS の表示用コピー。builder 族のみ) */
  dent?: { m: number; w: number };
  /** ±60° 弧の接合点(代表腕 = +Z 上の z 距離。樹枝状・羊歯のみ) */
  sideBranchJunctionZ?: number;
  /** 面ラベル({0001}・{10-1̄0}・{10-1̄1} — Unicode 表記は docs と同一) */
  faces: { basal?: BilingualText; prism?: BilingualText; pyramidal?: BilingualText };
  /** 角度弧(値は {120, 240, ±60, 28.0, 70.3} に限る — テストで固定) */
  arcs: ArcSpec[];
  /** 一文注記(弧で表せない関係の説明 — 扇形・星状・例外 2 形態) */
  note?: BilingualText;
}

const BASAL: BilingualText = { ja: '{0001} 基底面', en: 'basal face' };
const PRISM: BilingualText = { ja: '{10-1̄0} 柱面', en: 'prism face' };

/**
 * 注記対応表(設計書 §3 の 14 形態 × {軸 / 面 / 角度})。
 * union 14 値の Record 網羅により、形態追加時は tsc が注記漏れを検出する
 * (案 M の LABELS と同じ仕組み)。包絡・断面の数値根拠は morphologies.ts の
 * 採用寸法(各行コメント)。
 */
export const ANNOTATIONS: Record<Morphology, AnnotationSpec> = {
  // 中心六角柱 r 0.72(= 0.6×1.2)・厚 0.24、骸晶層 r 0.6・厚 0.3
  角板: {
    phaseRad: CYLINDER_PHASE,
    envelope: { radius: 0.72, height: 0.3 },
    axes: 'standard',
    hexSection: { radius: 0.72, y: 0.12 },
    faces: { basal: BASAL, prism: PRISM },
    arcs: [{ deg: 120, kind: 'interior' }],
  },
  // CylinderGeometry(0.6, 0.6, 0.4, 6)
  厚角板: {
    phaseRad: CYLINDER_PHASE,
    envelope: { radius: 0.6, height: 0.4 },
    axes: 'standard',
    hexSection: { radius: 0.6, y: 0.2 },
    faces: { basal: BASAL, prism: PRISM },
    arcs: [{ deg: 120, kind: 'interior' }],
  },
  // 最外層 r 0.6・厚 0.3(面ラベルは最外層基準 — §3)
  骸晶角板: {
    phaseRad: CYLINDER_PHASE,
    envelope: { radius: 0.6, height: 0.3 },
    axes: 'standard',
    hexSection: { radius: 0.6, y: 0.15 },
    faces: {
      basal: BASAL,
      prism: { ja: '{10-1̄0} 柱面(最外層)', en: 'prism face (outer layer)' },
    },
    arcs: [{ deg: 120, kind: 'interior' }],
  },
  // CylinderGeometry(0.4, 0.4, 1.5, 6)
  角柱: {
    phaseRad: CYLINDER_PHASE,
    envelope: { radius: 0.4, height: 1.5 },
    axes: 'standard',
    hexSection: { radius: 0.4, y: 0.75 },
    faces: { basal: BASAL, prism: PRISM },
    arcs: [{ deg: 120, kind: 'interior' }],
  },
  // LONG_COLUMN_DIMS = { radius: 0.25, height: 2.0 }
  長柱: {
    phaseRad: CYLINDER_PHASE,
    envelope: { radius: 0.25, height: 2.0 },
    axes: 'standard',
    hexSection: { radius: 0.25, y: 1.0 },
    faces: { basal: BASAL, prism: PRISM },
    arcs: [{ deg: 120, kind: 'interior' }],
  },
  // 花形断面 R 0.4(DENT_DIMS.skeletal)・全高 1.5(コア + リップリング)— builder 族
  骸晶角柱: {
    phaseRad: BUILDER_PHASE,
    envelope: { radius: 0.4, height: 1.5 },
    axes: 'standard',
    hexSection: { radius: 0.4, y: 0.75 },
    dent: { m: 0.16, w: 0.08 },
    faces: {
      basal: { ja: '{0001} 窪み端面', en: 'basal face (hollowed end)' },
      prism: PRISM,
    },
    arcs: [
      { deg: 120, kind: 'interior' },
      { deg: 240, kind: 'reflex' },
    ],
  },
  // 最外層 = 花形断面 R 0.4(DENT_DIMS.sheath)・高さ 2.0×0.8 = 1.6 — builder 族(F1: 外殻基準)
  さや: {
    phaseRad: BUILDER_PHASE,
    envelope: { radius: 0.4, height: 1.6 },
    axes: 'standard',
    hexSection: { radius: 0.4, y: 0.8 },
    dent: { m: 0.1, w: 0.05 },
    faces: { prism: { ja: '{10-1̄0} 柱面(外殻)', en: 'prism face (outer shell)' } },
    arcs: [{ deg: 240, kind: 'reflex' }],
  },
  // 中心柱 = 花形断面 R 0.4(sheath と同パラメタ)・高さ 1.6。針 12 本は上下 ±2.8 まで
  // — builder 族(F1: 中心柱基準。針クラスタは Cylinder 族 30° で内外不整合 — 将来 CP)
  針: {
    phaseRad: BUILDER_PHASE,
    envelope: { radius: 0.55, height: 5.6 },
    axes: 'standard',
    hexSection: { radius: 0.4, y: 0.8 },
    dent: { m: 0.1, w: 0.05 },
    faces: { prism: { ja: '{10-1̄0} 柱面(中心柱)', en: 'prism face (central column)' } },
    arcs: [{ deg: 240, kind: 'reflex' }],
  },
  // 花弁先端 0.42 + 1.1 = 1.52・厚 0.2。花弁方位 = a 軸(30° + k·60°)は一文注記で
  扇形: {
    phaseRad: CYLINDER_PHASE,
    envelope: { radius: 1.52, height: 0.2 },
    axes: 'standard',
    faces: {},
    arcs: [],
    note: { ja: '花弁方位 = a 軸(30° + k·60°)', en: 'petals along a-axes (30° + k·60°)' },
  },
  // 主枝長 2.1・中心柱厚 0.2。±60° 弧は最外接合点(0.5×(2 + 1.5) = 1.75)に置く
  樹枝状: {
    phaseRad: CYLINDER_PHASE,
    envelope: { radius: 2.1, height: 0.2 },
    axes: 'standard',
    sideBranchJunctionZ: 1.75,
    faces: {},
    arcs: [
      { deg: 60, kind: 'sideBranch' },
      { deg: -60, kind: 'sideBranch' },
    ],
    note: { ja: '腕 = a 軸・副枝 ±60° = 隣接 a 軸平行', en: 'arms ∥ a-axes; side branches ±60°' },
  },
  // 樹枝状の族(副枝なし)— 対照を一文注記(§3)
  星状: {
    phaseRad: CYLINDER_PHASE,
    envelope: { radius: 2.1, height: 0.2 },
    axes: 'standard',
    faces: {},
    arcs: [],
    note: { ja: '腕 = a 軸(副枝なしの対照)', en: 'arms ∥ a-axes (no side branches)' },
  },
  // 樹枝状の族(副枝 5 対)— 最外接合点 0.3×(4 + 1.0) = 1.5
  羊歯: {
    phaseRad: CYLINDER_PHASE,
    envelope: { radius: 2.1, height: 0.2 },
    axes: 'standard',
    sideBranchJunctionZ: 1.5,
    faces: {},
    arcs: [
      { deg: 60, kind: 'sideBranch' },
      { deg: -60, kind: 'sideBranch' },
    ],
    note: { ja: '腕 = a 軸・副枝 ±60°(5 対)', en: 'arms ∥ a-axes; side branches ±60° (5 pairs)' },
  },
  // 腕 = 錐 h 0.3×(c/a) + 柱 0.9 ≈ 1.39。腕ごとに c 軸(R6)→ 代表 1 腕のみ(裁量 3)
  砲弾集合: {
    phaseRad: BUILDER_PHASE,
    envelope: { radius: 1.39, height: 2.78 },
    axes: 'rosette',
    faces: { pyramidal: { ja: '{10-1̄1} 錐面', en: 'pyramidal face' } },
    arcs: [{ deg: 28.0, kind: 'pyramid' }],
    note: { ja: '代表 1 腕のみ注記(腕ごとに c 軸)', en: 'one representative arm (c-axis per arm)' },
  },
  // フィン外接半径 ≤ 0.9×1.2、スパイン ±R + スタッガ ±0.36。スパイン = a 軸 ∥ +Y(R7)
  側面: {
    phaseRad: BUILDER_PHASE,
    envelope: { radius: 0.94, height: 2.88 },
    axes: 'spine',
    faces: {},
    arcs: [{ deg: 70.3, kind: 'dihedral' }],
    note: { ja: 'スパイン = a 軸・c 軸はフィンごと', en: 'spine = a-axis; c-axis per fin' },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// シード依存形態の代表要素(createSnowCrystal の既定シード 1 の決定性を再生)
// ─────────────────────────────────────────────────────────────────────────

/** createSnowCrystal の既定シード(表示専用コピー — createSnowCrystal.ts:8)。 */
const DEFAULT_SEED = 1;

/** 砲弾の採用寸法(createBulletRosette 既定の表示用コピー)。 */
export const ROSETTE_DISPLAY = { radius: 0.3, bodyLength: 0.9 } as const;

export interface RosetteArmAnnotation {
  /** 代表腕(第 1 腕)の c 軸方向(単位ベクトル) */
  axis: readonly [number, number, number];
  /** 腕軸まわりロール [rad]。錐面アポセム方位は腕ローカルで −roll (mod 60°) */
  rollRad: number;
  /** apex の中心埋め込み δ = 0.05·R */
  apexOffset: number;
  /** 腕全長(錐 h = R·c/a + 柱 L) */
  armLength: number;
  /** 錐面アポセム長(apex → 底辺中点)= 錐高 / cos(28.0°) */
  pyramidFaceLength: number;
}

/**
 * 砲弾集合の代表 1 腕(設計書 §3 表・裁量 3)。
 * createBulletRosette と同じ rng 消費順(sampleRosetteAxes 全消費 → 第 1 腕の
 * rotateY ロール)を再生して、第 1 腕の方位とロールを得る。
 */
export function rosetteRepresentativeArm(): RosetteArmAnnotation {
  const rng = mulberry32(DEFAULT_SEED);
  const axes = sampleRosetteAxes(rng);
  const rollRad = rng() * Math.PI * 2; // ループ 1 周目の bullet.rotateY と同順
  const apexHeight = ROSETTE_DISPLAY.radius * ICE_C_OVER_A;
  return {
    axis: axes[0],
    rollRad,
    apexOffset: 0.05 * ROSETTE_DISPLAY.radius,
    armLength: apexHeight + ROSETTE_DISPLAY.bodyLength,
    pyramidFaceLength: apexHeight / Math.cos(PYRAMID_FACE_ANGLE_FROM_AXIS_RAD),
  };
}

export interface SidePlaneArcAnnotation {
  /** 弧の開始フィンの rotation.y [deg](実フィン角 — ジッタ込み) */
  fromRotationDeg: number;
  /** 終端 = 開始 + 70.3(CSL アンカー。隣のフィンとはジッタ ±6° 内で一致) */
  toRotationDeg: number;
}

/**
 * 側面の二面角 70.3° 弧(設計書 §3 表・裁量 3)。
 * createSidePlanes と同じ rng 消費順でフィン配置を再生し、基底オフセットが
 * ちょうど 70.3° 差のフィン対を探して、実フィン角から CSL アンカー角の弧を張る。
 * (実フィンはジッタ ±6° を持つため、弧はアンカー角 70.3° の側で固定する)
 */
export function sidePlaneDihedralArc(): SidePlaneArcAnnotation {
  const layout = sampleSidePlaneLayout(mulberry32(DEFAULT_SEED));
  for (const a of layout) {
    for (const b of layout) {
      if (
        a.baseOffsetDeg !== null &&
        b.baseOffsetDeg !== null &&
        Math.abs(b.baseOffsetDeg - a.baseOffsetDeg - CSL_TWIN_ANGLE_DEG) < 1e-9
      ) {
        return { fromRotationDeg: a.angleDeg, toRotationDeg: a.angleDeg + CSL_TWIN_ANGLE_DEG };
      }
    }
  }
  // 等間隔フォールバック配置(baseOffsetDeg = null)時: 先頭フィンからアンカー角
  return {
    fromRotationDeg: layout[0].angleDeg,
    toRotationDeg: layout[0].angleDeg + CSL_TWIN_ANGLE_DEG,
  };
}
