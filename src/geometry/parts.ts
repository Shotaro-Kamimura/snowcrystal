import { THREE } from '../three';
import { COLORS } from '../classify';
import {
  CSL_TWIN_ANGLE_DEG,
  elongatedHexOutline,
  halfHexOutline,
  hexPyramidApexHeight,
} from './crystallography';
import { sampleRosetteAxes } from './rosette';

// Geometry part builders. Originally ported from the snownotes viewer
// (main-fixed.js); the remaining builders are crystallography-based
// reimplementations on top of src/geometry/crystallography.ts.

/** elongatedHexOutline を押し出した伸長六角形プリズム（原点 = 基部頂点、長軸 = +Y）。 */
export function createElongatedHexPrism(
  width: number,
  length: number,
  thickness: number,
): THREE.Mesh {
  const outline = elongatedHexOutline(width, length);
  const shape = new THREE.Shape();
  shape.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    shape.lineTo(outline[i][0], outline[i][1]);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.translate(0, 0, -thickness / 2); // 厚み中心合わせ

  const material = new THREE.MeshStandardMaterial({ color: COLORS.wing, flatShading: true });
  return new THREE.Mesh(geometry, material);
}

/**
 * 砲弾（ML66 C1c/C1d 統合）部品。六角柱 + {10-1̄1} 六角錐の終端。
 *
 * ローカル座標規約: 錐の apex = 原点、軸 = +Y。
 * 錐は y ∈ [0, h]（h = hexPyramidApexHeight(radius) ≈ 1.628·R、錐面は軸から 28.0°）、
 * 柱は y ∈ [h, h + bodyLength]。両リングの 6 頂点は位相整合し一致する。
 * children: [0] = 錐、[1] = 柱。マテリアルは COLORS.wing / flatShading: true（統一規約）。
 *
 * 将来拡張（予約、引数は今回追加しない）:
 * - tipTruncation: 錐先端を小さな基底面で切る（既定 0 = シャープ apex）
 * - hollow: C1d の基底側空洞（骸晶系と同じ意匠）
 */
export function createBullet(radius: number, bodyLength: number): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: COLORS.wing, flatShading: true });

  const apexHeight = hexPyramidApexHeight(radius);

  // 錐: ConeGeometry は apex が +Y 端なので反転し、apex を原点・底リングを y = h に置く
  const coneGeo = new THREE.ConeGeometry(radius, apexHeight, 6);
  coneGeo.rotateX(Math.PI);
  coneGeo.translate(0, apexHeight / 2, 0);
  group.add(new THREE.Mesh(coneGeo, material));

  // 柱: 下リングが錐の底リングと一致するよう y ∈ [h, h + bodyLength] に配置
  const bodyGeo = new THREE.CylinderGeometry(radius, radius, bodyLength, 6, 1);
  bodyGeo.translate(0, apexHeight + bodyLength / 2, 0);
  group.add(new THREE.Mesh(bodyGeo, material));

  return group;
}

export interface BulletRosetteOptions {
  /** 砲弾の外接半径(既定 0.3。角柱の半径 0.4 の 0.75 倍) */
  radius?: number;
  /** 柱部長(既定 0.9 = 3R。設計書 §2 の既定アスペクト 2.5R〜3R の上限側) */
  bodyLength?: number;
  /** 腕本数(省略時 rng で 3〜6) */
  count?: number;
}

/**
 * 砲弾集合(ML66 C2a)。凍結雲粒起源の多結晶を、共通中心から放射する
 * 3〜6 本の砲弾(錐端=中心向き)で表す(設計書 §3)。
 *
 * - 腕方位は sampleRosetteAxes(全ペア相互角 ≥ 50°、失敗時は正準配置)。
 * - 各砲弾は apex を中心方向へ δ = 0.05·R 埋め込み(隙間・Zファイト回避。
 *   多結晶コアの明示モデル化はしない)。
 * - 軸まわりロール角は腕ごとに rng。第一版は全砲弾同寸(長さ揺らぎは opts で後送)。
 */
export function createBulletRosette(
  rng: () => number,
  opts: BulletRosetteOptions = {},
): THREE.Group {
  const radius = opts.radius ?? 0.3;
  const bodyLength = opts.bodyLength ?? 0.9;
  const embed = 0.05 * radius; // δ

  const group = new THREE.Group();
  const yAxis = new THREE.Vector3(0, 1, 0);

  for (const [ax, ay, az] of sampleRosetteAxes(rng, opts.count)) {
    const bullet = createBullet(radius, bodyLength);
    const axis = new THREE.Vector3(ax, ay, az);

    // ローカル +Y(apex→柱)を腕方位へ向け、軸まわりに個別ロール
    bullet.quaternion.setFromUnitVectors(yAxis, axis);
    bullet.rotateY(rng() * Math.PI * 2);

    // apex を中心へ δ 埋め込み(腕は軸に沿って [-δ, h+L-δ] を占める)
    bullet.position.set(-embed * ax, -embed * ay, -embed * az);

    group.add(bullet);
  }

  return group;
}

/**
 * 半六角フィン(側面の部品)。halfHexOutline を厚み 0.05·R で押し出した薄板。
 * 原点 = スパイン辺の中点、スパイン = ローカル +Y、フィンは +X 側へ張り出す
 * (アウトラインのスパインは a 軸 [1,0] 沿いなので −90° 回転で立てる)。
 */
export function createSideFin(circumradius: number): THREE.Mesh {
  const outline = halfHexOutline(circumradius);
  const shape = new THREE.Shape();
  shape.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    shape.lineTo(outline[i][0], outline[i][1]);
  }
  shape.closePath();

  const thickness = 0.05 * circumradius;
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.rotateZ(-Math.PI / 2); // スパイン [±R,0] → (0,∓R)、フィン +y → +X 側
  geometry.translate(0, 0, -thickness / 2); // 厚み中心合わせ

  const material = new THREE.MeshStandardMaterial({ color: COLORS.wing, flatShading: true });
  return new THREE.Mesh(geometry, material);
}

/**
 * 側面の二面角オフセット規定集合 [deg](案B)。
 * CSL 双晶角 70.3° の 1 段(±70.3)・2 段(±140.6)・補角(±109.7 = 180−70.3)。
 * ±140.6 の両符号化は N=7 と要素数の不整合解消(設計書 §4、2026-06-10 修正)。
 */
export const SIDE_PLANE_OFFSETS_DEG: readonly number[] = [
  0,
  CSL_TWIN_ANGLE_DEG,
  -CSL_TWIN_ANGLE_DEG,
  180 - CSL_TWIN_ANGLE_DEG,
  -(180 - CSL_TWIN_ANGLE_DEG),
  2 * CSL_TWIN_ANGLE_DEG,
  -2 * CSL_TWIN_ANGLE_DEG,
];

export interface SidePlaneFin {
  /** スパイン軸まわりの最終二面角 [deg](θ0 + オフセット + ジッタ、[0, 360)) */
  angleDeg: number;
  /** ジッタ除去後の基底オフセット [deg](SIDE_PLANE_OFFSETS_DEG の要素。等間隔フォールバック時は null) */
  baseOffsetDeg: number | null;
  /** サイズジッタ(0.8〜1.2) */
  radiusScale: number;
  /** スパイン方向スタッガ(R_base 倍率、±0.4) */
  staggerRatio: number;
}

const JITTER_DEG = 6;
const MIN_GAP_DEG = 20;
const MAX_LAYOUT_ATTEMPTS = 200;

function normalize360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function minCircularGapDeg(angles: number[]): number {
  const sorted = [...angles].sort((a, b) => a - b);
  let min = 360 - sorted[sorted.length - 1] + sorted[0];
  for (let i = 0; i + 1 < sorted.length; i++) {
    min = Math.min(min, sorted[i + 1] - sorted[i]);
  }
  return min;
}

/**
 * 側面フィンの配置列をシード乱数で生成する(設計書 §4 案B)。
 * 基準角 θ0 + 規定集合から重複なく選んだオフセット + ジッタ ±6°。
 * 最小角間隔 20°(mod 360°)を満たすまで再抽選(上限 200 回)、
 * 上限到達で等間隔配置にフォールバック(baseOffsetDeg = null)。
 * 本数は count 省略時 rng で 4〜7 一様。決定性は mulberry32 経路(針・ロゼットと同流儀)。
 */
export function sampleSidePlaneLayout(rng: () => number, count?: number): SidePlaneFin[] {
  const n = count === undefined ? 4 + Math.floor(rng() * 4) : Math.min(7, Math.max(4, Math.floor(count)));
  const theta0 = rng() * 360;

  let angles: number[] | null = null;
  let baseOffsets: (number | null)[] = [];
  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt++) {
    const pool = [...SIDE_PLANE_OFFSETS_DEG];
    const offsets: number[] = [];
    for (let i = 0; i < n; i++) {
      offsets.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    const candidate = offsets.map((o) => normalize360(theta0 + o + (rng() * 2 - 1) * JITTER_DEG));
    if (minCircularGapDeg(candidate) >= MIN_GAP_DEG) {
      angles = candidate;
      baseOffsets = offsets;
      break;
    }
  }
  if (angles === null) {
    // 等間隔フォールバック(案A相当)
    angles = Array.from({ length: n }, (_, k) => normalize360(theta0 + (k * 360) / n));
    baseOffsets = Array.from({ length: n }, () => null);
  }

  return angles.map((angleDeg, i) => ({
    angleDeg,
    baseOffsetDeg: baseOffsets[i],
    radiusScale: 0.8 + rng() * 0.4,
    staggerRatio: (rng() * 2 - 1) * 0.4,
  }));
}

export interface SidePlanesOptions {
  /** フィンの基準外接半径(既定 0.9) */
  radiusBase?: number;
  /** フィン枚数(省略時 rng で 4〜7) */
  count?: number;
}

/**
 * 側面(ML66 S1。S2 は同レンダラの approx)。凍結雲粒起源の多結晶を、
 * 共通スパイン(a 軸)から異なる二面角で張り出す 4〜7 枚の半六角薄板で表す
 * (設計書 §3〜§4)。二面角は CSL 双晶角 70.3° アンカー+ジッタ(案B)。
 * 中心構造は追加せず、薄板同士がスパイン近傍で自然に交差して芯が立つ。
 */
export function createSidePlanes(
  rng: () => number,
  opts: SidePlanesOptions = {},
): THREE.Group {
  const radiusBase = opts.radiusBase ?? 0.9;
  const group = new THREE.Group();

  for (const fin of sampleSidePlaneLayout(rng, opts.count)) {
    const mesh = createSideFin(radiusBase * fin.radiusScale);
    mesh.rotation.y = (fin.angleDeg * Math.PI) / 180; // 共有スパイン(+Y)まわりの二面角
    mesh.position.y = fin.staggerRatio * radiusBase; // スパイン方向スタッガ
    group.add(mesh);
  }

  return group;
}

export function createBranchWithChildren(angleRad: number): THREE.Group {
  const group = new THREE.Group();

  // 主枝（伸長六角形プリズム: 先端120°ファセット）。基部頂点 = 原点で中心柱内に隠れ、
  // 長さ2.1により先端 z=2.1 が最外副枝の先端 z=2.05 を 0.05 リードする
  const mainBranch = createElongatedHexPrism(0.08, 2.1, 0.08);
  mainBranch.rotation.x = Math.PI / 2; // XZ平面に寝かせ、長軸 = +Z

  group.add(mainBranch);

  // 副枝の数と間隔
  const sideCount = 3;
  const spacing = 0.5;
  const joinX = 0.04; // 主枝（伸長六角形プリズム width 0.08）の半幅 = 主枝平行側面上の接合点

  for (let i = 0; i < sideCount; i++) {
    const offsetZ = spacing * (i + 1.5);

    // 左右の副枝（伸長六角形プリズム: 全内角120°・対辺平行）
    const petalL = createElongatedHexPrism(0.3, 0.6, 0.05);
    const petalR = createElongatedHexPrism(0.3, 0.6, 0.05);

    // XZ平面上に寝かせ、長軸の先端を主枝の先端側（外向き）へ±60°で開く
    // （結晶学的に副枝は隣接a軸に平行 = 主枝に対し±60°、開き120°）。
    // 原点 = 基部頂点なので position が接合点そのもの。基部の片エッジは
    // 長軸-60°側にあり、±60°回転後は主枝側面と平行に密着する
    petalL.rotation.x = Math.PI / 2;
    petalL.rotation.z = Math.PI / 3; // 先端方向 (-sin60°, 0, +cos60°)
    petalL.position.set(-joinX, 0, offsetZ);

    petalR.rotation.x = Math.PI / 2;
    petalR.rotation.z = -Math.PI / 3; // 先端方向 (+sin60°, 0, +cos60°)
    petalR.position.set(joinX, 0, offsetZ);

    group.add(petalL, petalR);
  }

  // 🔁 全体を角度分だけ回転（groupごと回す！）
  group.rotation.y = -angleRad;

  return group;
}
