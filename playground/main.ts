import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createSnowCrystal,
  disposeCrystal,
  getCrystalType,
  getGlobalLabel,
  classifyOnDiagram,
  waterSaturationExcessDensity,
  ML66,
  type Morphology,
} from '../src/index';

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
  樹枝状: { ja: '樹枝状', en: 'Dendrite' },
  砲弾集合: { ja: '砲弾集合', en: 'Combination of Bullets' },
  側面: { ja: '側面', en: 'Side Planes' },
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

const morphJa = document.getElementById('morph-ja') as HTMLElement;
const morphEn = document.getElementById('morph-en') as HTMLElement;
const globalCode = document.getElementById('global-code') as HTMLElement;
const hierarchyEl = document.getElementById('hierarchy') as HTMLElement;
const regionLine = document.getElementById('region-line') as HTMLElement;

const nakaya = document.getElementById('nakaya') as HTMLCanvasElement;
const nctx = nakaya.getContext('2d') as CanvasRenderingContext2D;

// ─────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────
type Mode = 'climate' | 'manual';
let mode: Mode = 'climate';
let current: THREE.Group | null = null;
let currentMorph: Morphology = '樹枝状';

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
  if (mode === 'manual' && morphologySelect.value) {
    currentMorph = morphologySelect.value as Morphology;
    swap(createSnowCrystal({ morphology: currentMorph }));
  } else {
    const temp = readTemp();
    const vapor = readVapor();
    currentMorph = getCrystalType(temp, vapor);
    swap(createSnowCrystal({ temperature: temp, supersaturation: vapor }));
  }

  updateInfo();
  drawNakaya();
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
// Info panel
// ─────────────────────────────────────────────────────────────────────────
function updateInfo(): void {
  const label = LABELS[currentMorph];
  morphJa.textContent = label.ja;
  morphEn.textContent = label.en;

  const code = getGlobalLabel(currentMorph);
  globalCode.textContent = code || '—';

  const lines = HIERARCHY[code] ?? [];
  hierarchyEl.innerHTML = lines
    .map((line, i) => (i === lines.length - 1 ? `<div class="cur">${line}</div>` : `<div>${line}</div>`))
    .join('');

  tempVal.textContent = `−${parseFloat(tempSlider.value).toFixed(1)} ℃`;
  vaporVal.textContent = readVapor().toFixed(3);

  modeTag.textContent =
    mode === 'manual'
      ? '入力: 形態を直接選択（気温・水蒸気量は無視）'
      : '入力: 気温・水蒸気量（スライダー連動）';

  // スライダーモード時のみ ML66 領域を表示（形態タイトル・Global 欄は不変）
  if (mode === 'climate') {
    const hit = classifyOnDiagram(readTemp(), readVapor(), ML66);
    regionLine.textContent = `領域 / Region: ${hit.region.labelJa} (${hit.mlCode ?? '—'})`;
    regionLine.style.display = '';
  } else {
    regionLine.textContent = '';
    regionLine.style.display = 'none';
  }
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
  // 手動モードは選択 morphology に属する全領域を強調
  const hit = classifyOnDiagram(readTemp(), readVapor(), ML66);
  nctx.textAlign = 'center';
  nctx.textBaseline = 'middle';
  for (const r of REGION_LABELS.anchors) {
    const active =
      mode === 'climate'
        ? r.regionId === hit.region.id
        : ML66.regions[r.regionId].morphology === currentMorph;
    nctx.fillStyle = active ? '#cfe2ff' : 'rgba(154,166,189,0.65)';
    nctx.font = active ? '600 10px system-ui, sans-serif' : '10px system-ui, sans-serif';
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

  // current marker (only meaningful in climate mode)
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
// Input wiring — last interacted control wins
// ─────────────────────────────────────────────────────────────────────────
function onClimateInput(): void {
  mode = 'climate';
  morphologySelect.value = ''; // reflect that sliders are now in charge
  rebuild();
}

tempSlider.addEventListener('input', onClimateInput);
vaporSlider.addEventListener('input', onClimateInput);

morphologySelect.addEventListener('change', () => {
  if (morphologySelect.value) {
    mode = 'manual';
  } else {
    mode = 'climate';
  }
  rebuild();
});

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
}

resizeToCanvas();
rebuild();
animate();
