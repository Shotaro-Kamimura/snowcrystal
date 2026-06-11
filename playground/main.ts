// 成長パスモード(Phase 3a)は growth モジュールを ../src/growth/ への深い import で
// 使用する — 3a 暫定・0.3.0 で公開面へ(設計書 §6)。src/index.ts には追加しない
// (公開 API 面 = README の不変条件を維持。npm 利用者からは exports "." により不可視)。
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {
  createSnowCrystal,
  disposeCrystal,
  getCrystalType,
  getGlobalLabel,
  classifyOnDiagram,
  waterSaturationExcessDensity,
  ML66,
  type Morphology,
  type RegionHit,
} from '../src/index';
import { renderGrowthPath } from '../src/growth/renderGrowthPath'; // 3a 暫定(深い import、冒頭コメント参照)
import type { GrowthStage, PathHit } from '../src/growth/types'; // 3a 暫定(同上)
import { dentedHexOutline } from '../src/geometry/hexOutlineBuilder'; // 案 N: 240° 弧の頂点計算(純関数・表示専用)
import { buildBroadBranchPlan2 } from '../src/geometry/morphologies'; // 案 K K-a: 広幅枝 案 2(internal — K2 申し送りどおり公開 API に出さない)
import { provisionalSuffix } from '../src/diagram/provisional'; // 案 K §2.1: 仮フラグ('provisional: ' 接頭辞)のパーサ
import {
  ANNOTATIONS,
  PYRAMID_FACE_ANGLE_FROM_AXIS_RAD,
  rosetteRepresentativeArm,
  sidePlaneDihedralArc,
  type AnnotationSpec,
  type BilingualText,
} from './annotations';

// ─────────────────────────────────────────────────────────────────────────
// Display-only data tables.
// The library (src/) intentionally does not export TITLE_MAP / FULL_SUBTYPE_MAP,
// so the playground keeps its own minimal copies. src/ is never modified.
// ─────────────────────────────────────────────────────────────────────────
const LABELS: Record<Morphology, { ja: string; en: string }> = {
  針: { ja: '針', en: 'Needle' },
  さや: { ja: 'さや', en: 'Sheath' },
  角柱: { ja: '角柱', en: 'Column' },
  骸晶角柱: { ja: '骸晶角柱', en: 'Skeleton Column' },
  角板: { ja: '角板', en: 'Plate' },
  厚角板: { ja: '厚角板', en: 'Thick Solid Plate' },
  骸晶角板: { ja: '骸晶角板', en: 'Skeleton Plate' },
  扇形: { ja: '扇形', en: 'Sector' },
  広幅枝: { ja: '広幅枝', en: 'Broad Branches' },
  樹枝状: { ja: '樹枝状', en: 'Dendrite' },
  砲弾集合: { ja: '砲弾集合', en: 'Combination of Bullets' },
  側面: { ja: '側面', en: 'Side Planes' },
  星状: { ja: '星状', en: 'Stellar Crystal' },
  羊歯: { ja: '羊歯', en: 'Fernlike Crystal' },
  長柱: { ja: '長柱', en: 'Long Solid Column' },
};

// Global-classification lineage per code (mirrors FULL_SUBTYPE_MAP for display).
const HIERARCHY: Record<string, string[]> = {
  C1a: ['C — 柱状結晶群 / Column group', 'C1 — 針状結晶 / Needle-type', 'C1a — 針 / Needle'],
  C2a: ['C — 柱状結晶群 / Column group', 'C2 — 鞘状結晶 / Sheath-type', 'C2a — さや / Sheath'],
  C3a: ['C — 柱状結晶群 / Column group', 'C3 — 角柱状結晶 / Column-type', 'C3a — 角柱 / Solid column'],
  C3b: ['C — 柱状結晶群 / Column group', 'C3 — 角柱状結晶 / Column-type', 'C3b — 骸晶角柱 / Skeletal column'],
  P1a: ['P — 板状結晶群 / Plane group', 'P1 — 角板状結晶 / Plate-type', 'P1a — 角板 / Plate'],
  P1b: ['P — 板状結晶群 / Plane group', 'P1 — 角板状結晶 / Plate-type', 'P1b — 厚角板 / Thick plate'],
  P1c: ['P — 板状結晶群 / Plane group', 'P1 — 角板状結晶 / Plate-type', 'P1c — 骸晶角板 / Skeletal plate'],
  P4f: ['P — 板状結晶群 / Plane group', 'P4 — 複合板状結晶 / Composite plate', 'P4f — 扇付角板 / Plate with sectors'],
  P4g: ['P — 板状結晶群 / Plane group', 'P4 — 複合板状結晶 / Composite plate', 'P4g — 樹枝付角板 / Plate with dendrites'],
};

// 成長パスモードのステージ色(設計書 §5 のモック配色)。図上の点・矢印、冠柱の
// 柱(①)/ キャップ(②)塗り分け、情報パネルの行マーカーに共通で使う。
const STAGE_COLORS = ['#5DCAA5', '#85B7EB'] as const;

// ─────────────────────────────────────────────────────────────────────────
// Scene / renderer (all visual styling lives here in the playground)
// ─────────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('scene') as HTMLCanvasElement;

const scene = new THREE.Scene();
const BG = new THREE.Color(0x141821); // calm, faintly blue-grey (not pure black)
scene.background = BG;
scene.fog = new THREE.Fog(0x141821, 12, 26);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
// Slightly raised, three-quarter view for depth.
camera.position.set(4.2, 3.0, 6.2);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Size is driven by the canvas element's own box (see resizeToCanvas), not the
// window — so the layout (full-screen on desktop, 56vh block on mobile) controls it.

// 結晶学注記レイヤー(案 N)のラベル描画: CSS2DRenderer を併設(設計書 §2.3)。
// オーバーレイは pointer-events: none・z-index 5(canvas 0 とパネル 10 の間)で、
// 固定値でなく canvas.getBoundingClientRect() への矩形同期によりデスクトップ
// (fixed 全面)・モバイル(文書フロー内 52vh)の両レイアウトに追従する。
const css2d = new CSS2DRenderer();
css2d.domElement.style.position = 'fixed';
css2d.domElement.style.left = '0';
css2d.domElement.style.top = '0';
css2d.domElement.style.pointerEvents = 'none';
css2d.domElement.style.zIndex = '5';
document.body.appendChild(css2d.domElement);

/** オーバーレイ div を canvas の表示矩形に同期(setSize が width/height style も設定)。 */
function syncOverlayRect(): void {
  const rect = canvas.getBoundingClientRect();
  css2d.domElement.style.left = `${rect.left}px`;
  css2d.domElement.style.top = `${rect.top}px`;
  if (rect.width > 0 && rect.height > 0) css2d.setSize(rect.width, rect.height);
}
// モバイル(文書フロー内 canvas)のスクロールずれ対策。リサイズ系は resizeToCanvas が担う
window.addEventListener('scroll', syncOverlayRect, { passive: true });

// 一文注記(裁量 8)の画面固定キャプション(目視ラウンド 1 修正: 3D 追従の
// CSS2DObject だと真上視点で c 軸ラベルと中央衝突するため、オーバーレイ内の
// canvas 下端中央に固定する)。表示は updateAnnotations が管理
const annotCaption = document.createElement('div');
annotCaption.className = 'annot-caption';
annotCaption.style.display = 'none';
css2d.domElement.appendChild(annotCaption);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0, 0);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.9;
// Pause auto-rotation while the user is actively dragging.
controls.addEventListener('start', () => {
  controls.autoRotate = false;
});
controls.addEventListener('end', () => {
  controls.autoRotate = true;
});

// Lighting: hemisphere fill + two soft directionals so facets and edges read.
scene.add(new THREE.HemisphereLight(0xdfe7ff, 0x3a3f4a, 0.85));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
keyLight.position.set(5, 8, 6);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x9fc0ff, 0.45);
rimLight.position.set(-6, 2, -4);
scene.add(rimLight);

// ─────────────────────────────────────────────────────────────────────────
// DOM references
// ─────────────────────────────────────────────────────────────────────────
const tempSlider = document.getElementById('temp') as HTMLInputElement;
const vaporSlider = document.getElementById('vapor') as HTMLInputElement;
const tempVal = document.getElementById('temp-val') as HTMLElement;
const vaporVal = document.getElementById('vapor-val') as HTMLElement;
const morphologySelect = document.getElementById('morphology') as HTMLSelectElement;
const modeTag = document.getElementById('mode-tag') as HTMLElement;
const modeSwitch = document.getElementById('mode-switch') as HTMLElement;
const modeButtons = Array.from(modeSwitch.querySelectorAll('button'));
const annotToggle = document.getElementById('annot-toggle') as HTMLInputElement;
const broadVariantButtons = Array.from(
  (document.getElementById('broad-variant') as HTMLElement).querySelectorAll('button'),
);

const provBadge = document.getElementById('prov-badge') as HTMLElement;
const morphJa = document.getElementById('morph-ja') as HTMLElement;
const morphEn = document.getElementById('morph-en') as HTMLElement;
const globalCode = document.getElementById('global-code') as HTMLElement;
const hierarchyEl = document.getElementById('hierarchy') as HTMLElement;
const regionLine = document.getElementById('region-line') as HTMLElement;
const pathInfo = document.getElementById('path-info') as HTMLElement;
const pathStage1El = document.getElementById('path-stage-1') as HTMLElement;
const pathStage2El = document.getElementById('path-stage-2') as HTMLElement;
const pathCompositeEl = document.getElementById('path-composite') as HTMLElement;

const nakaya = document.getElementById('nakaya') as HTMLCanvasElement;
const nctx = nakaya.getContext('2d') as CanvasRenderingContext2D;

// ─────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────
type Mode = 'climate' | 'manual' | 'path';
let mode: Mode = 'climate';
let current: THREE.Group | null = null;
let currentMorph: Morphology = '樹枝状';

// 成長パスモードの状態。モードを離れても点は保持し、復帰時に復元する。
// stages[0] = ステージ①(中心部)/ stages[1] = ステージ②(外周)。
const pathStages: [GrowthStage | null, GrowthStage | null] = [null, null];
let selectedStage: 0 | 1 = 0; // スライダー 2 本が束ねられる「選択中ステージ」
let draggingStage: 0 | 1 | null = null;

// 広幅枝(P1c)2 案比較トグルの状態(案 K K-a)。既定 = 案 1(ライブラリ既定と同じ)。
// 案 2 は internal ビルダーの深い import で差し替える — 広幅枝表示時のみ有効
let broadVariant: 1 | 2 = 1;

/** Slider is 0..40 (positive); temperature is the negative of that. */
function readTemp(): number {
  return -parseFloat(tempSlider.value);
}
function readVapor(): number {
  return parseFloat(vaporSlider.value);
}

// ─────────────────────────────────────────────────────────────────────────
// Build / rebuild the crystal (always dispose the previous group first)
// ─────────────────────────────────────────────────────────────────────────
function rebuild(): void {
  // No seed param: the library defaults to a fixed seed, so output stays
  // deterministic without exposing a seed control in the UI.
  if (mode === 'path') {
    const [s0, s1] = pathStages;
    if (s0 && s1) {
      const group = renderGrowthPath([s0, s1]);
      paintGrowthParts(group);
      swap(group);
    } else if (s0) {
      // ① のみ設置: 単一条件として描画(無着色)。② の設置でパス描画へ切替
      swap(createSnowCrystal({ temperature: s0.temperature, supersaturation: s0.supersaturation }));
    }
    // 点が未設置の間は直前の結晶を保持する
  } else if (mode === 'manual' && morphologySelect.value) {
    currentMorph = morphologySelect.value as Morphology;
    swap(buildCrystal({ morphology: currentMorph }));
  } else {
    const temp = readTemp();
    const vapor = readVapor();
    currentMorph = getCrystalType(temp, vapor);
    swap(buildCrystal({ temperature: temp, supersaturation: vapor }));
  }

  updateInfo();
  updateBroadVariantUI();
  drawNakaya();
  updateAnnotations(); // swap 後の再構築フック(案 N — パスモードでは disabled/非表示)
}

/**
 * 結晶ビルド(比較トグル対応): 広幅枝を表示中でトグルが案 2 のときのみ
 * internal ビルダーへ差し替える。それ以外は従来どおり createSnowCrystal
 * (= 案 1 がライブラリ既定)。currentMorph は呼び出し前に確定していること。
 */
function buildCrystal(params: Parameters<typeof createSnowCrystal>[0]): THREE.Group {
  if (broadVariant === 2 && currentMorph === '広幅枝') return buildBroadBranchPlan2();
  return createSnowCrystal(params);
}

/**
 * 冠柱(CP1a)のみ userData.part で柱 = ①色 / キャップ = ②色に上書きする
 * (マテリアルは CP-P3-2 で Mesh ごとに個別インスタンス化済み)。
 * 委譲描画(複合なし・classification-only)は無着色 = 既定マテリアルのまま。
 */
function paintGrowthParts(group: THREE.Group): void {
  const hit = group.userData.pathHit as PathHit;
  if (hit.composite?.morphology !== '冠柱') return;
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const part = obj.userData.part as 'column' | 'cap' | undefined;
    if (!part) return;
    const material = obj.material as THREE.MeshStandardMaterial;
    material.color.set(part === 'column' ? STAGE_COLORS[0] : STAGE_COLORS[1]);
  });
}

function swap(next: THREE.Group): void {
  if (current) {
    scene.remove(current);
    disposeCrystal(current); // free GPU buffers of the replaced crystal
  }
  current = next;
  scene.add(current);
}

// ─────────────────────────────────────────────────────────────────────────
// 結晶学注記レイヤー(案 N 設計書 §3〜§4)。
// 配置は ANNOTATIONS(playground/annotations.ts)の方位規約 + 包絡定数からの
// 計算のみで、メッシュ内部は走査しない(§4.3)。注記一式は annotGroup 1 つに
// 組み、swap 後に現形態のレコードから再構築する。
// ─────────────────────────────────────────────────────────────────────────

// 配色(§4.2 候補の採用): c 軸 = ステージ②系 / a 軸 = ステージ①系。
// 角度弧・角度値はどちらとも被らない琥珀系。
const ANNOT_C_COLOR = STAGE_COLORS[1];
const ANNOT_A_COLOR = STAGE_COLORS[0];
const ANNOT_ARC_COLOR = '#ffb86b';

let annotGroup: THREE.Group | null = null;
let annotMorph: Morphology | null = null;

/** ja / en 2 行の CSS2DObject ラベル(.annot — 既存パネルと同じ併記様式)。 */
function annotLabel(ja: string, en?: string, color?: string): CSS2DObject {
  const div = document.createElement('div');
  div.className = 'annot';
  if (color) div.style.color = color;
  const main = document.createElement('div');
  main.textContent = ja;
  div.appendChild(main);
  if (en) {
    const sub = document.createElement('div');
    sub.className = 'annot-en';
    sub.textContent = en;
    div.appendChild(sub);
  }
  return new CSS2DObject(div);
}

/** 軸矢印 + 先端ラベル(ArrowHelper — §4.2。長頭化を避けるため頭部をキャップ)。 */
function annotArrow(
  group: THREE.Group,
  dir: THREE.Vector3,
  origin: THREE.Vector3,
  length: number,
  color: string,
  label: BilingualText | string,
): void {
  const headLength = Math.min(0.2 * length, 0.22);
  const arrow = new THREE.ArrowHelper(dir, origin, length, new THREE.Color(color), headLength, headLength * 0.6);
  group.add(arrow);
  const tip = origin.clone().addScaledVector(dir, length + 0.14);
  const text = typeof label === 'string' ? annotLabel(label, undefined, color) : annotLabel(label.ja, label.en, color);
  text.position.copy(tip);
  group.add(text);
}

/**
 * 角度弧: EllipseCurve で 2D 弧を生成し、平面基底 (u, n×u) で 3D へ写像した
 * THREE.Line(§4.2)。u = 開始方向、n = 弧平面の法線、sweepRad = 掃引角(正)。
 * 弧の中点方向に角度値の CSS2DObject を置く。
 */
function annotArc(
  group: THREE.Group,
  center: THREE.Vector3,
  u: THREE.Vector3,
  n: THREE.Vector3,
  sweepRad: number,
  radius: number,
  labelText: string,
  labelOffset = 1.45,
): void {
  const w = n.clone().cross(u).normalize();
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, sweepRad, false, 0);
  const pts = curve
    .getPoints(48)
    .map((p) => center.clone().addScaledVector(u, p.x).addScaledVector(w, p.y));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: ANNOT_ARC_COLOR })));

  const mid = center
    .clone()
    .addScaledVector(u, Math.cos(sweepRad / 2) * radius * labelOffset)
    .addScaledVector(w, Math.sin(sweepRad / 2) * radius * labelOffset);
  const label = annotLabel(labelText, undefined, ANNOT_ARC_COLOR);
  label.position.copy(mid);
  group.add(label);
}

/** 2 方向 u1→u2 の最短弧(< 180°)。reflex = true で長周り(240° など)。 */
function annotArcBetween(
  group: THREE.Group,
  center: THREE.Vector3,
  u1: THREE.Vector3,
  u2: THREE.Vector3,
  radius: number,
  labelText: string,
  reflex = false,
  labelOffset = 1.45,
): void {
  const angle = u1.angleTo(u2);
  const n = u1.clone().cross(u2).normalize();
  if (reflex) {
    annotArc(group, center, u1, n.negate(), 2 * Math.PI - angle, radius, labelText, labelOffset);
  } else {
    annotArc(group, center, u1, n, angle, radius, labelText, labelOffset);
  }
}

/** 方位角 az [rad] の XZ 平面単位ベクトル(世界方位 φ = atan2(z, x) — §2.1)。 */
function azDir(az: number): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
}

/** c 軸 + a 軸 3 本(R1〜R3。a 軸位相は族で切替)。 */
function buildStandardAxes(group: THREE.Group, spec: AnnotationSpec): void {
  const aLen = spec.envelope.radius * 1.3;
  const cLen = Math.max(spec.envelope.height / 2, spec.envelope.radius) * 1.3;
  annotArrow(group, new THREE.Vector3(0, 1, 0), new THREE.Vector3(), cLen, ANNOT_C_COLOR, {
    ja: 'c 軸',
    en: 'c-axis',
  });
  const A_SUB = ['a₁', 'a₂', 'a₃'];
  for (let k = 0; k < 3; k++) {
    annotArrow(group, azDir(spec.phaseRad + (k * Math.PI) / 3), new THREE.Vector3(), aLen, ANNOT_A_COLOR, A_SUB[k]);
  }
}

/** 面ラベル({0001}・{10-1̄0})— 六角断面の端面中央寄り / 柱面アポセム外側。 */
function buildFaceLabels(group: THREE.Group, spec: AnnotationSpec): void {
  if (!spec.hexSection) return;
  const { radius: rHex, y: yTop } = spec.hexSection;
  const faceAz = spec.phaseRad + Math.PI / 6; // 面中心方位 = 角頂点 + 30°(両族共通)
  if (spec.faces.basal) {
    const label = annotLabel(spec.faces.basal.ja, spec.faces.basal.en);
    // 0.6R: c 軸ラベルとの中央密集の緩和(目視ラウンド 1 修正)
    label.position.set(Math.cos(faceAz) * rHex * 0.6, yTop + 0.03, Math.sin(faceAz) * rHex * 0.6);
    group.add(label);
  }
  if (spec.faces.prism) {
    const apothem = rHex * (Math.sqrt(3) / 2);
    const label = annotLabel(spec.faces.prism.ja, spec.faces.prism.en);
    label.position.copy(azDir(faceAz).multiplyScalar(apothem * 1.06));
    group.add(label);
  }
}

/** 内角 120° 弧 — 角頂点(方位 = 族位相)の端面上。 */
function buildInteriorArc(group: THREE.Group, spec: AnnotationSpec): void {
  if (!spec.hexSection) return;
  const { radius: rHex, y } = spec.hexSection;
  const yTop = y + 0.02;
  const vertexAz = spec.phaseRad;
  const p = (az: number): THREE.Vector3 =>
    new THREE.Vector3(Math.cos(az) * rHex, yTop, Math.sin(az) * rHex);
  const v = p(vertexAz);
  const u1 = p(vertexAz + Math.PI / 3).sub(v).normalize();
  const u2 = p(vertexAz - Math.PI / 3).sub(v).normalize();
  annotArcBetween(group, v, u1, u2, rHex * 0.3, '120°');
}

/**
 * 凹角 240° 弧 — 花形断面(dentedHexOutline)の溝床コーナー(設計書 §3 案 B 3 形態)。
 * アウトラインは CCW・断面方位保存(dentedHexColumn の rotateX 規約)なので、
 * 2D (x, y) → 世界 (x, ·, y) に写し、右折頂点(反時計回りで cross < 0)を凹角とする。
 */
function buildReflexArc(group: THREE.Group, spec: AnnotationSpec): void {
  if (!spec.hexSection || !spec.dent) return;
  const { radius: rHex, y } = spec.hexSection;
  const pts = dentedHexOutline(rHex, spec.dent.m, spec.dent.w);
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const v = pts[i];
    const next = pts[(i + 1) % pts.length];
    const cross =
      (v[0] - prev[0]) * (next[1] - v[1]) - (v[1] - prev[1]) * (next[0] - v[0]);
    if (cross >= 0) continue; // 左折(内角 120°)はスキップ — 最初の右折 = 凹角 240°
    const yTop = y + 0.02;
    const center = new THREE.Vector3(v[0], yTop, v[1]);
    const u1 = new THREE.Vector3(prev[0] - v[0], 0, prev[1] - v[1]).normalize();
    const u2 = new THREE.Vector3(next[0] - v[0], 0, next[1] - v[1]).normalize();
    annotArcBetween(group, center, u1, u2, Math.min(spec.dent.m, spec.dent.w) * 0.8, '240°', true, 2.4);
    return;
  }
}

/** 副枝 ±60° 弧 — 代表腕(+Z、i = 0)の最外接合点(R5)。 */
function buildSideBranchArcs(group: THREE.Group, spec: AnnotationSpec): void {
  if (spec.sideBranchJunctionZ === undefined) return;
  const center = new THREE.Vector3(0, 0.07, spec.sideBranchJunctionZ);
  const uMain = new THREE.Vector3(0, 0, 1); // 主枝方向(先端側)
  for (const arc of spec.arcs) {
    if (arc.kind !== 'sideBranch') continue;
    const az = Math.PI / 2 + (arc.deg * Math.PI) / 180; // 副枝方位 = 主枝 90° ± 60°
    annotArcBetween(group, center, uMain, azDir(az), 0.32, `${arc.deg > 0 ? '+' : '−'}60°`);
  }
}

/** 砲弾集合(R6): 代表 1 腕の c 軸 + {10-1̄1} + 28.0° 弧(裁量 3)。 */
function buildRosetteAnnotations(group: THREE.Group, spec: AnnotationSpec): void {
  const arm = rosetteRepresentativeArm();
  const axis = new THREE.Vector3(...arm.axis);
  const apex = axis.clone().multiplyScalar(-arm.apexOffset);

  annotArrow(group, axis, apex, arm.armLength * 1.3, ANNOT_C_COLOR, {
    ja: 'c 軸(代表腕)',
    en: 'c-axis (one arm)',
  });

  // 錐面アポセム方向: 腕ローカルで方位 −roll(rotateY ロール込みの実方位)・
  // 軸から 28.0°。quaternion(+Y → 腕方位)で世界系へ
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  const a0 = -arm.rollRad;
  const sin28 = Math.sin(PYRAMID_FACE_ANGLE_FROM_AXIS_RAD);
  const cos28 = Math.cos(PYRAMID_FACE_ANGLE_FROM_AXIS_RAD);
  const slant = new THREE.Vector3(sin28 * Math.cos(a0), cos28, sin28 * Math.sin(a0))
    .applyQuaternion(q)
    .normalize();

  // 錐面の稜線(apex → 底辺中点)を引いて 28.0° のもう一辺を見せる
  const slantEnd = apex.clone().addScaledVector(slant, arm.pyramidFaceLength);
  const legGeo = new THREE.BufferGeometry().setFromPoints([apex.clone(), slantEnd]);
  group.add(new THREE.Line(legGeo, new THREE.LineBasicMaterial({ color: ANNOT_ARC_COLOR })));

  annotArcBetween(group, apex, axis, slant, arm.pyramidFaceLength * 0.72, '28.0°');

  if (spec.faces.pyramidal) {
    const label = annotLabel(spec.faces.pyramidal.ja, spec.faces.pyramidal.en);
    label.position.copy(apex.clone().addScaledVector(slant, arm.pyramidFaceLength * 1.18));
    group.add(label);
  }
}

/** 側面(R7): スパイン = a 軸 ∥ +Y + 二面角 70.3° 弧(裁量 3)。 */
function buildSidePlaneAnnotations(group: THREE.Group, spec: AnnotationSpec): void {
  const spineLen = (spec.envelope.height / 2) * 1.3;
  annotArrow(group, new THREE.Vector3(0, 1, 0), new THREE.Vector3(), spineLen, ANNOT_A_COLOR, {
    ja: 'a 軸(スパイン)',
    en: 'a-axis (spine)',
  });

  // フィンは rotation.y = ρ で配置され世界方位は −ρ(方位シフト規約)。
  // 実フィン角から CSL アンカー 70.3° の弧を張る(annotations.ts 参照)
  const arc = sidePlaneDihedralArc();
  const azFrom = (-arc.fromRotationDeg * Math.PI) / 180;
  const azTo = (-arc.toRotationDeg * Math.PI) / 180;
  const center = new THREE.Vector3(0, 0.45, 0);
  annotArcBetween(group, center, azDir(azFrom), azDir(azTo), spec.envelope.radius * 0.62, '70.3°', false, 1.25);
}

/** 現形態の注記グループをレコード(ANNOTATIONS)から構築する。 */
function buildAnnotationGroup(morph: Morphology): THREE.Group {
  const spec = ANNOTATIONS[morph];
  const group = new THREE.Group();

  if (spec.axes === 'standard') {
    buildStandardAxes(group, spec);
    buildFaceLabels(group, spec);
    if (spec.arcs.some((a) => a.kind === 'interior')) buildInteriorArc(group, spec);
    if (spec.arcs.some((a) => a.kind === 'reflex')) buildReflexArc(group, spec);
    buildSideBranchArcs(group, spec);
  } else if (spec.axes === 'rosette') {
    buildRosetteAnnotations(group, spec);
  } else {
    buildSidePlaneAnnotations(group, spec);
  }

  return group;
}

/** 一文注記キャプションの内容更新(note なしの形態・非表示時は隠す)。 */
function renderAnnotCaption(note: BilingualText | undefined): void {
  if (!note) {
    annotCaption.style.display = 'none';
    return;
  }
  annotCaption.replaceChildren();
  const ja = document.createElement('div');
  ja.textContent = note.ja;
  const en = document.createElement('div');
  en.className = 'annot-en';
  en.textContent = note.en;
  annotCaption.append(ja, en);
  annotCaption.style.display = '';
}

/**
 * 可視切替。CSS2DRenderer はラベル自身の visible しか見ない(親グループの
 * 非表示は波及しない)ため、ラベルにも明示的に反映する。
 */
function setAnnotVisible(visible: boolean): void {
  if (!annotGroup) return;
  annotGroup.visible = visible;
  annotGroup.traverse((obj) => {
    if (obj instanceof CSS2DObject) obj.visible = visible;
  });
}

/** レコード切替時の破棄。CSS2D ラベルの DOM 要素も明示的に取り除く。 */
function disposeAnnotations(): void {
  if (!annotGroup) return;
  annotGroup.traverse((obj) => {
    if (obj instanceof CSS2DObject) {
      obj.element.remove();
      return;
    }
    const withGeo = obj as THREE.Mesh | THREE.Line;
    if (withGeo.geometry) withGeo.geometry.dispose();
    const material = (withGeo as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(material)) {
      for (const m of material) m.dispose();
    } else if (material) {
      material.dispose();
    }
  });
  scene.remove(annotGroup);
  annotGroup = null;
  annotMorph = null;
}

/**
 * swap 後・トグル操作・モード切替の合流点。
 * パスモードは対象外(裁量 2): トグルを disabled にし注記も隠す。
 * トグル OFF は visible = false(dispose はレコード切替時のみ)。
 */
function updateAnnotations(): void {
  annotToggle.disabled = mode === 'path';
  const want = annotToggle.checked && mode !== 'path';
  if (!want) {
    setAnnotVisible(false);
    renderAnnotCaption(undefined); // トグル OFF / パスモードはキャプションも非表示
    return;
  }
  if (!annotGroup || annotMorph !== currentMorph) {
    disposeAnnotations();
    annotGroup = buildAnnotationGroup(currentMorph);
    annotMorph = currentMorph;
    scene.add(annotGroup);
  }
  setAnnotVisible(true);
  renderAnnotCaption(ANNOTATIONS[currentMorph].note);
}

annotToggle.addEventListener('change', updateAnnotations);

// ─────────────────────────────────────────────────────────────────────────
// Info panel
// ─────────────────────────────────────────────────────────────────────────
/**
 * 仮バッジ(案 K §2.2)。判定は ML66 データセットの source 接頭辞 'provisional: '
 * からの導出のみで、playground 側に仮形態のハードコード表を持たない(単一情報源)。
 * suffix(何が仮か)は title 属性(ホバー)で示す。3D キャンバス上には出さない。
 */
function renderProvBadge(suffix: string | null): void {
  provBadge.hidden = suffix === null;
  if (suffix !== null) {
    provBadge.title = `仮実装: ${suffix} — 9 月専門家確認待ち / Provisional — pending expert review`;
  }
}

/** 手動モード用: 形態に対応する ML66 領域から仮 suffix を引く(該当なしは null)。 */
function provisionalSuffixForMorph(morph: Morphology): string | null {
  for (const region of Object.values(ML66.regions)) {
    if (region.morphology !== morph) continue;
    const suffix = provisionalSuffix(region.source);
    if (suffix !== null) return suffix;
  }
  return null;
}

/** 広幅枝 2 案トグルの有効/無効と選択ハイライト(広幅枝表示時のみ有効)。 */
function updateBroadVariantUI(): void {
  const enabled = currentMorph === '広幅枝' && mode !== 'path';
  for (const btn of broadVariantButtons) {
    btn.disabled = !enabled;
    btn.classList.toggle('active', Number(btn.dataset.variant) === broadVariant);
  }
}

function renderHierarchy(lines: string[]): void {
  hierarchyEl.innerHTML = lines
    .map((line, i) => (i === lines.length - 1 ? `<div class="cur">${line}</div>` : `<div>${line}</div>`))
    .join('');
}

function updateInfo(): void {
  tempVal.textContent = `−${parseFloat(tempSlider.value).toFixed(1)} ℃`;
  vaporVal.textContent = readVapor().toFixed(3);

  if (mode === 'path') {
    updatePathInfo();
    return;
  }
  pathInfo.style.display = 'none';

  const label = LABELS[currentMorph];
  morphJa.textContent = label.ja;
  morphEn.textContent = label.en;

  const code = getGlobalLabel(currentMorph);
  globalCode.textContent = code || '—';
  renderHierarchy(HIERARCHY[code] ?? []);

  modeTag.textContent =
    mode === 'manual'
      ? '入力: 形態を直接選択（気温・水蒸気量は無視）'
      : '入力: 気温・水蒸気量（スライダー連動）';

  // スライダーモード時のみ ML66 領域を表示（形態タイトル・Global 欄は不変）。
  // 仮バッジ: climate は表示中 region の source から、manual は形態の対応 region から導出
  if (mode === 'climate') {
    const hit = classifyOnDiagram(readTemp(), readVapor(), ML66);
    regionLine.textContent = `領域 / Region: ${hit.region.labelJa} (${hit.mlCode ?? '—'})`;
    regionLine.style.display = '';
    renderProvBadge(provisionalSuffix(hit.region.source));
  } else {
    regionLine.textContent = '';
    regionLine.style.display = 'none';
    renderProvBadge(provisionalSuffixForMorph(currentMorph));
  }
}

/** ステージ行: 図と同じ記号(① ○ / ② ●)+ 従来の形態 / Region 表示。 */
function stageRowHtml(idx: 0 | 1, hit: RegionHit | null): string {
  const num = idx === 0 ? '①' : '②';
  const sym = idx === 0 ? '○' : '●';
  const mark = `<span class="mark" style="color: ${STAGE_COLORS[idx]}">${sym}</span> ${num} `;
  if (!hit) return `${mark}—（図をクリックで設定）`;
  const label = LABELS[hit.morphology];
  return `${mark}${label.ja} / ${label.en} — ${hit.region.labelJa} (${hit.mlCode ?? '—'})`;
}

function updatePathInfo(): void {
  pathInfo.style.display = '';
  regionLine.textContent = '';
  regionLine.style.display = 'none';
  modeTag.textContent = '入力: 成長パス（図をクリック ①→②・ドラッグで移動）';

  const [s0, s1] = pathStages;
  // 両点あり: renderGrowthPath が group.userData.pathHit に格納した分類を流用
  const pathHit = s0 && s1 ? ((current?.userData.pathHit as PathHit | undefined) ?? null) : null;
  const h0 =
    pathHit?.stages[0] ?? (s0 ? classifyOnDiagram(s0.temperature, s0.supersaturation, ML66) : null);
  const h1 =
    pathHit?.stages[1] ?? (s1 ? classifyOnDiagram(s1.temperature, s1.supersaturation, ML66) : null);

  pathStage1El.innerHTML = stageRowHtml(0, h0);
  pathStage2El.innerHTML = stageRowHtml(1, h1);
  pathStage1El.classList.toggle('sel', selectedStage === 0);
  pathStage2El.classList.toggle('sel', selectedStage === 1);

  // 複合行(COMPOSITE_TABLE のフィールドに即した 3 パターン)
  const c = pathHit?.composite ?? null;
  pathCompositeEl.textContent = !c
    ? '複合型: —'
    : c.morphology
      ? `複合型: ${c.labelJa} (${c.mlCode}) — ${c.source}`
      : `複合型: ${c.labelJa} (${c.mlCode})（専用描画なし — 最終条件の形態で表示）`;

  // 大見出しは「描画中の 3D」を表す: 冠柱は専用表記、委譲時は最終(または唯一)
  // ステージの形態。点が未設置の間は直前の表示を保持(3D も直前のまま)。
  if (c?.morphology === '冠柱') {
    morphJa.textContent = c.labelJa;
    morphEn.textContent = 'Column with plates'; // ML66 Table 1 の英名
    globalCode.textContent = c.mlCode;
    renderHierarchy([]); // CP 系の系統表示データは 3a では持たない
    renderProvBadge(provisionalSuffix(c.source)); // CompositeEntry.source も同じ規約(案 K §2.2)
    return;
  }
  const lead = h1 ?? h0;
  if (lead) {
    const label = LABELS[lead.morphology];
    morphJa.textContent = label.ja;
    morphEn.textContent = label.en;
    const code = getGlobalLabel(lead.morphology);
    globalCode.textContent = code || '—';
    renderHierarchy(HIERARCHY[code] ?? []);
  }
  // 大見出し = 描画中(最終または唯一)ステージの形態 → バッジもその region から
  renderProvBadge(lead ? provisionalSuffix(lead.region.source) : null);
}

// ─────────────────────────────────────────────────────────────────────────
// 2D condition diagram — generated entirely from the ML66 dataset (single
// source, design doc §10). Region fills, boundary curves, labels and the
// water-saturation line all derive from ML66 + waterSaturationExcessDensity;
// classification itself stays in classifyOnDiagram (no re-implementation).
//   x: temperature 0 (left) .. -40 (right)
//   y: vapor ρ 0 (bottom) .. 0.3 (top)。s→ρ 変換は ρ(T) = sTop(T) × ρ_ws(T) のみ
// ─────────────────────────────────────────────────────────────────────────
const PAD = { l: 38, r: 12, t: 10, b: 26 };
const TEMP_MAX = -40;
const VAP_MAX = 0.3;

function gx(temp: number): number {
  const w = nakaya.width - PAD.l - PAD.r;
  return PAD.l + (-temp / -TEMP_MAX) * w; // -temp in 0..40
}
function gy(vapor: number): number {
  const h = nakaya.height - PAD.t - PAD.b;
  return PAD.t + (1 - vapor / VAP_MAX) * h;
}

type Band = (typeof ML66)['bands'][number];

const SAMPLE_DT = 0.25;

/** バンド内 T での sTop 線形補間（[tMax端, tMin端]、lookup と同じ規約）。 */
function lerpSTop(sTop: readonly [number, number], band: Band, t: number): number {
  const f = (band.tMax - t) / (band.tMax - band.tMin);
  return sTop[0] + (sTop[1] - sTop[0]) * f;
}

/** 段 idx の上側境界 ρ(T) = sTop(T) × ρ_ws(T)。最上段（∞）は VAP_MAX でキャップ。 */
function upperRho(band: Band, idx: number, t: number): number {
  const sTop = band.stack[idx].sTop;
  if (!sTop) return VAP_MAX;
  return Math.min(lerpSTop(sTop, band, t) * waterSaturationExcessDensity(t), VAP_MAX);
}

/** 段 idx の下側境界 ρ(T)（最下段は 0）。 */
function lowerRho(band: Band, idx: number, t: number): number {
  return idx === 0 ? 0 : upperRho(band, idx - 1, t);
}

/** バンドの T サンプル列（tMax → tMin、端点含む、ΔT=0.25）。 */
function sampleTemps(band: Band): number[] {
  const out: number[] = [];
  for (let t = band.tMax; t > band.tMin; t -= SAMPLE_DT) out.push(t);
  out.push(band.tMin);
  return out;
}

interface RegionLabelAnchor {
  regionId: string;
  labelJa: string;
  x: number;
  y: number;
}

/**
 * 領域ラベル: regionId ごとに「連続するバンドのまとまり」へグループ化し、
 * 各まとまりの中央 T における領域 [下限, 上限] の中央 s を ρ→y 変換した点に置く。
 * 可視高さ 8px 未満の領域（羊歯などのスライバー）はフィルのみでラベル省略。
 */
function buildRegionLabels(): { anchors: RegionLabelAnchor[]; skipped: string[] } {
  const runs: Array<{ regionId: string; first: number; last: number }> = [];
  const open = new Map<string, { regionId: string; first: number; last: number }>();
  ML66.bands.forEach((band, bi) => {
    const present = new Set(band.stack.map((e) => e.regionId));
    for (const [id, run] of [...open]) {
      if (!present.has(id)) {
        runs.push(run);
        open.delete(id);
      }
    }
    for (const id of present) {
      const run = open.get(id);
      if (run) run.last = bi;
      else open.set(id, { regionId: id, first: bi, last: bi });
    }
  });
  runs.push(...open.values());

  const MIN_LABEL_PX = 8;
  const anchors: RegionLabelAnchor[] = [];
  const skipped: string[] = [];
  for (const run of runs) {
    const tCenter = (ML66.bands[run.first].tMax + ML66.bands[run.last].tMin) / 2;
    const band =
      ML66.bands.find((b) => tCenter <= b.tMax && tCenter > b.tMin) ??
      ML66.bands[ML66.bands.length - 1];
    const idx = band.stack.findIndex((e) => e.regionId === run.regionId);
    if (idx < 0) continue;
    const lo = lowerRho(band, idx, tCenter);
    const hi = upperRho(band, idx, tCenter);
    const labelJa = ML66.regions[run.regionId].labelJa;
    if (Math.abs(gy(lo) - gy(hi)) < MIN_LABEL_PX) {
      skipped.push(`${labelJa} (${run.regionId})`);
      continue;
    }
    // プロット外へのはみ出しはクランプ
    const x = Math.min(Math.max(gx(tCenter), PAD.l + 12), nakaya.width - PAD.r - 12);
    const y = Math.min(Math.max(gy((lo + hi) / 2), PAD.t + 6), nakaya.height - PAD.b - 6);
    anchors.push({ regionId: run.regionId, labelJa, x, y });
  }
  return { anchors, skipped };
}

const REGION_LABELS = buildRegionLabels();
if (REGION_LABELS.skipped.length > 0) {
  console.info('[diagram] sliver regions without label:', REGION_LABELS.skipped.join(', '));
}

function drawRegionFills(): void {
  for (const band of ML66.bands) {
    const temps = sampleTemps(band);

    // 段フィル（段位置の偶奇で低アルファ2種を交互に）
    band.stack.forEach((_, idx) => {
      nctx.beginPath();
      temps.forEach((t, i) => {
        if (i === 0) nctx.moveTo(gx(t), gy(upperRho(band, idx, t)));
        else nctx.lineTo(gx(t), gy(upperRho(band, idx, t)));
      });
      for (let i = temps.length - 1; i >= 0; i--) {
        nctx.lineTo(gx(temps[i]), gy(lowerRho(band, idx, temps[i])));
      }
      nctx.closePath();
      nctx.fillStyle = idx % 2 === 0 ? 'rgba(127,180,255,0.06)' : 'rgba(127,180,255,0.12)';
      nctx.fill();
    });

    // 境界線（有限 sTop の曲線のみ。細い低アルファ白）
    band.stack.forEach((entry, idx) => {
      if (!entry.sTop) return;
      nctx.beginPath();
      temps.forEach((t, i) => {
        if (i === 0) nctx.moveTo(gx(t), gy(upperRho(band, idx, t)));
        else nctx.lineTo(gx(t), gy(upperRho(band, idx, t)));
      });
      nctx.strokeStyle = 'rgba(255,255,255,0.10)';
      nctx.lineWidth = 0.75;
      nctx.stroke();
    });
  }
}

function drawWaterSaturation(): void {
  // s = 1 すなわち ρ_ws(T) の破線カーブ（極大は −12 付近）
  nctx.beginPath();
  for (let t = 0; t >= TEMP_MAX; t -= SAMPLE_DT) {
    const y = gy(Math.min(waterSaturationExcessDensity(t), VAP_MAX));
    if (t === 0) nctx.moveTo(gx(t), y);
    else nctx.lineTo(gx(t), y);
  }
  nctx.setLineDash([4, 3]);
  nctx.strokeStyle = 'rgba(207,226,255,0.5)';
  nctx.lineWidth = 1;
  nctx.stroke();
  nctx.setLineDash([]);

  nctx.font = '9px system-ui, sans-serif';
  nctx.fillStyle = 'rgba(207,226,255,0.55)';
  nctx.textAlign = 'center';
  nctx.textBaseline = 'bottom';
  nctx.fillText('水飽和 / water sat.', gx(-34), gy(waterSaturationExcessDensity(-34)) - 3);
}

function drawNakaya(): void {
  const w = nakaya.width;
  const h = nakaya.height;
  nctx.clearRect(0, 0, w, h);

  // plot background
  nctx.fillStyle = 'rgba(255,255,255,0.02)';
  nctx.fillRect(PAD.l, PAD.t, w - PAD.l - PAD.r, h - PAD.t - PAD.b);

  // ML66 dataset-driven fills + water saturation curve
  drawRegionFills();
  drawWaterSaturation();

  // frame
  nctx.strokeStyle = 'rgba(255,255,255,0.18)';
  nctx.lineWidth = 1;
  nctx.strokeRect(PAD.l, PAD.t, w - PAD.l - PAD.r, h - PAD.t - PAD.b);

  // region labels — スライダーモードは classifyOnDiagram の hit と region.id 一致で強調、
  // 手動モードは選択 morphology に属する全領域を強調、
  // パスモードは ①② の所属領域をステージ色で強調(同一領域は ② 優先)
  const hit = classifyOnDiagram(readTemp(), readVapor(), ML66);
  const pathRegion0 =
    mode === 'path' && pathStages[0]
      ? classifyOnDiagram(pathStages[0].temperature, pathStages[0].supersaturation, ML66).region.id
      : null;
  const pathRegion1 =
    mode === 'path' && pathStages[1]
      ? classifyOnDiagram(pathStages[1].temperature, pathStages[1].supersaturation, ML66).region.id
      : null;
  nctx.textAlign = 'center';
  nctx.textBaseline = 'middle';
  for (const r of REGION_LABELS.anchors) {
    let color: string | null = null;
    if (mode === 'path') {
      if (r.regionId === pathRegion1) color = STAGE_COLORS[1];
      else if (r.regionId === pathRegion0) color = STAGE_COLORS[0];
    } else {
      const active =
        mode === 'climate'
          ? r.regionId === hit.region.id
          : ML66.regions[r.regionId].morphology === currentMorph;
      if (active) color = '#cfe2ff';
    }
    nctx.fillStyle = color ?? 'rgba(154,166,189,0.65)';
    nctx.font = color ? '600 10px system-ui, sans-serif' : '10px system-ui, sans-serif';
    nctx.fillText(r.labelJa, r.x, r.y);
  }

  // axis ticks (temperature)
  nctx.fillStyle = 'rgba(154,166,189,0.9)';
  nctx.font = '9px system-ui, sans-serif';
  nctx.textBaseline = 'top';
  for (let i = 0; i <= 4; i++) {
    const temp = -i * 10;
    nctx.fillText(String(temp), gx(temp), h - PAD.b + 4);
  }
  // axis ticks (vapor)
  nctx.textAlign = 'right';
  nctx.textBaseline = 'middle';
  for (let i = 0; i <= 3; i++) {
    const v = i * 0.1;
    nctx.fillText(v.toFixed(1), PAD.l - 4, gy(v));
  }

  // axis captions
  nctx.fillStyle = 'rgba(154,166,189,0.7)';
  nctx.textAlign = 'center';
  nctx.textBaseline = 'top';
  nctx.fillText('気温 ℃', (PAD.l + (w - PAD.r)) / 2, h - 11);

  // marker — climate: 現在点 / manual: 減光 / path: 現在点は出さず ①②+矢印が担う
  if (mode === 'path') {
    drawGrowthPathOverlay();
    return;
  }
  const mx = gx(readTemp());
  const my = gy(readVapor());
  if (mode === 'climate') {
    nctx.beginPath();
    nctx.arc(mx, my, 5, 0, Math.PI * 2);
    nctx.fillStyle = '#ff6b6b';
    nctx.fill();
    nctx.lineWidth = 2;
    nctx.strokeStyle = 'rgba(255,255,255,0.85)';
    nctx.stroke();
  } else {
    // dimmed marker so it's clear the diagram isn't driving the shape
    nctx.beginPath();
    nctx.arc(mx, my, 4, 0, Math.PI * 2);
    nctx.fillStyle = 'rgba(255,107,107,0.25)';
    nctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 成長パスモードの図上オーバーレイ(① ○ / ② ● / ①→② 矢印)と
// ポインタ操作(クリック設置・ドラッグ移動・点クリックで選択切替)
// ─────────────────────────────────────────────────────────────────────────
const STAGE_R = 6;

function drawStagePoint(idx: 0 | 1, x: number, y: number): void {
  nctx.beginPath();
  nctx.arc(x, y, STAGE_R, 0, Math.PI * 2);
  if (idx === 0) {
    // ① ○ 白抜き: 背景色で塗り潰し + ①色リング
    nctx.fillStyle = 'rgba(20, 24, 33, 0.92)';
    nctx.fill();
    nctx.lineWidth = 2.5;
    nctx.strokeStyle = STAGE_COLORS[0];
    nctx.stroke();
  } else {
    // ② ● 塗り
    nctx.fillStyle = STAGE_COLORS[1];
    nctx.fill();
    nctx.lineWidth = 1.5;
    nctx.strokeStyle = 'rgba(255,255,255,0.7)';
    nctx.stroke();
  }
  if (selectedStage === idx) {
    // 選択中ステージ(スライダーの束ね先)は薄いハローで示す
    nctx.beginPath();
    nctx.arc(x, y, STAGE_R + 4, 0, Math.PI * 2);
    nctx.lineWidth = 1.5;
    nctx.strokeStyle = 'rgba(255,255,255,0.45)';
    nctx.stroke();
  }
}

function drawGrowthPathOverlay(): void {
  const [s0, s1] = pathStages;
  const p0 = s0 ? { x: gx(s0.temperature), y: gy(s0.supersaturation) } : null;
  const p1 = s1 ? { x: gx(s1.temperature), y: gy(s1.supersaturation) } : null;

  // ①→② の矢印(円周から円周へ。軸は ①色→②色のグラデーション、矢頭は ②色)。
  // 2 点が近接して描き切れないときは省略し点のみ。
  if (p0 && p1) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    const HEAD = 7;
    const gap = STAGE_R + 3;
    if (dist > gap * 2 + HEAD) {
      const ux = dx / dist;
      const uy = dy / dist;
      const sx = p0.x + ux * gap;
      const sy = p0.y + uy * gap;
      const tx = p1.x - ux * gap; // 矢頭の先端
      const ty = p1.y - uy * gap;
      const bx = tx - ux * HEAD; // 矢頭の底 = 軸の終端
      const by = ty - uy * HEAD;
      const grad = nctx.createLinearGradient(sx, sy, tx, ty);
      grad.addColorStop(0, STAGE_COLORS[0]);
      grad.addColorStop(1, STAGE_COLORS[1]);
      nctx.beginPath();
      nctx.moveTo(sx, sy);
      nctx.lineTo(bx, by);
      nctx.strokeStyle = grad;
      nctx.lineWidth = 2;
      nctx.stroke();
      nctx.beginPath();
      nctx.moveTo(tx, ty);
      nctx.lineTo(bx - uy * 4.5, by + ux * 4.5);
      nctx.lineTo(bx + uy * 4.5, by - ux * 4.5);
      nctx.closePath();
      nctx.fillStyle = STAGE_COLORS[1];
      nctx.fill();
    }
  }
  if (p0) drawStagePoint(0, p0.x, p0.y);
  if (p1) drawStagePoint(1, p1.x, p1.y);
}

/** ポインタ位置 → canvas 描画バッファ座標(CSS 表示サイズとの比率を補正)。 */
function diagramXY(e: PointerEvent): { x: number; y: number } {
  const rect = nakaya.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * nakaya.width) / rect.width,
    y: ((e.clientY - rect.top) * nakaya.height) / rect.height,
  };
}

/** gx/gy の逆変換。プロット枠内へクランプし、スライダー step(0.5℃ / 0.001)へ丸める。 */
function xyToStage(x: number, y: number): GrowthStage {
  const w = nakaya.width - PAD.l - PAD.r;
  const h = nakaya.height - PAD.t - PAD.b;
  const fx = Math.min(Math.max((x - PAD.l) / w, 0), 1);
  const fy = Math.min(Math.max((y - PAD.t) / h, 0), 1);
  const temperature = -(Math.round(fx * -TEMP_MAX * 2) / 2);
  const supersaturation = Math.round((1 - fy) * VAP_MAX * 1000) / 1000;
  return { temperature, supersaturation };
}

/** 図上の点ヒット判定(半径 10px、重なりは ② 優先 = 描画の前面側)。 */
function findStageAt(x: number, y: number): 0 | 1 | null {
  const HIT_R = 10;
  let best: 0 | 1 | null = null;
  let bestD = HIT_R;
  for (const idx of [0, 1] as const) {
    const s = pathStages[idx];
    if (!s) continue;
    const d = Math.hypot(x - gx(s.temperature), y - gy(s.supersaturation));
    if (d <= bestD) {
      best = idx;
      bestD = d;
    }
  }
  return best;
}

/** 選択中ステージの条件を既存スライダー 2 本へ反映(パスモードの「束ね」)。 */
function syncSlidersToSelectedStage(): void {
  const s = pathStages[selectedStage];
  if (!s) return;
  tempSlider.value = String(-s.temperature);
  vaporSlider.value = String(s.supersaturation);
}

nakaya.addEventListener('pointerdown', (e) => {
  if (mode !== 'path') return;
  e.preventDefault();
  const { x, y } = diagramXY(e);
  const hitIdx = findStageAt(x, y);
  if (hitIdx !== null) {
    selectedStage = hitIdx; // 点クリック = 選択中ステージ切替(そのままドラッグ移動可)
  } else {
    const cond = xyToStage(x, y);
    if (!pathStages[0]) selectedStage = 0; // クリック 1 回目 = ①
    else if (!pathStages[1]) selectedStage = 1; // クリック 2 回目 = ②
    pathStages[selectedStage] = cond; // 両点設置後は選択中ステージを移動
  }
  draggingStage = selectedStage;
  nakaya.setPointerCapture(e.pointerId);
  syncSlidersToSelectedStage();
  rebuild();
});

nakaya.addEventListener('pointermove', (e) => {
  if (mode !== 'path' || draggingStage === null) return;
  const { x, y } = diagramXY(e);
  pathStages[draggingStage] = xyToStage(x, y);
  syncSlidersToSelectedStage();
  rebuild(); // 矢印・3D・情報パネルがドラッグに追従(スライダー input と同コスト)
});

function endStageDrag(e: PointerEvent): void {
  draggingStage = null;
  if (nakaya.hasPointerCapture(e.pointerId)) nakaya.releasePointerCapture(e.pointerId);
}
nakaya.addEventListener('pointerup', endStageDrag);
nakaya.addEventListener('pointercancel', endStageDrag);

// ─────────────────────────────────────────────────────────────────────────
// Input wiring — last interacted control wins(セグメントは明示切替、
// スライダー操作 → climate / 形態選択 → manual の暗黙切替も従来どおり維持。
// 例外: パスモード中のスライダーは選択中ステージを駆動し、モードは変えない)
// ─────────────────────────────────────────────────────────────────────────
function setMode(next: Mode): void {
  mode = next;
  for (const btn of modeButtons) btn.classList.toggle('active', btn.dataset.mode === mode);
  nakaya.style.cursor = mode === 'path' ? 'crosshair' : '';
  if (mode !== 'manual') morphologySelect.value = ''; // sliders / path are in charge
  if (mode === 'path') syncSlidersToSelectedStage(); // 復帰時: 保持していた点へ束ね直す
  rebuild();
}

for (const btn of modeButtons) {
  btn.addEventListener('click', () => {
    const next = btn.dataset.mode as Mode;
    // 手動セグメント押下で未選択なら、表示中の形態から開始
    if (next === 'manual' && !morphologySelect.value) morphologySelect.value = currentMorph;
    setMode(next);
  });
}

function onSliderInput(): void {
  if (mode === 'path') {
    // パスモード: スライダーは選択中ステージを駆動(点が無ければ ① を設置)
    pathStages[selectedStage] = { temperature: readTemp(), supersaturation: readVapor() };
    rebuild();
    return;
  }
  setMode('climate');
}

tempSlider.addEventListener('input', onSliderInput);
vaporSlider.addEventListener('input', onSliderInput);

morphologySelect.addEventListener('change', () => {
  setMode(morphologySelect.value ? 'manual' : 'climate');
});

// 広幅枝 2 案比較トグル(案 K K-a)。disabled 中はクリック不可なので
// 広幅枝表示時のみ発火する。切替は再ビルドのみ — モードは変えない
for (const btn of broadVariantButtons) {
  btn.addEventListener('click', () => {
    const next = Number(btn.dataset.variant) as 1 | 2;
    if (next === broadVariant) return;
    broadVariant = next;
    rebuild();
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Resize
// ─────────────────────────────────────────────────────────────────────────
// Follow the canvas element's actual rendered size (its CSS box), not the window.
// updateStyle=false: CSS owns the display size; we only set the drawing buffer.
function resizeToCanvas(): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  syncOverlayRect(); // css2d.setSize + 注記オーバーレイの矩形同期(案 N)
}

const ro = new ResizeObserver(resizeToCanvas);
ro.observe(canvas);
window.addEventListener('resize', resizeToCanvas);

// ─────────────────────────────────────────────────────────────────────────
// Render loop
// ─────────────────────────────────────────────────────────────────────────
function animate(): void {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  css2d.render(scene, camera); // 注記ラベル(案 N)
}

resizeToCanvas();
rebuild();
animate();
