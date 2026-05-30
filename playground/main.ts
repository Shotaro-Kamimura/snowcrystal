import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createSnowCrystal,
  disposeCrystal,
  getCrystalType,
  getGlobalLabel,
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
}

// ─────────────────────────────────────────────────────────────────────────
// 2D Nakaya diagram. Regions follow the thresholds in src/classify.ts
// (getCrystalType). classify.ts is read-only reference, never modified.
//   x: temperature 0 (left) .. -40 (right)
//   y: vapor 0 (bottom) .. 0.3 (top)
// ─────────────────────────────────────────────────────────────────────────
const PAD = { l: 38, r: 12, t: 10, b: 26 };
const TEMP_MIN = 0;
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

// Approximate region label anchors, derived from getCrystalType thresholds.
const REGION_LABELS: Array<{ t: number; v: number; text: string }> = [
  { t: -2, v: 0.2, text: '角板' },
  { t: -6, v: 0.025, text: '角柱' },
  { t: -7, v: 0.08, text: '骸晶角柱' },
  { t: -7, v: 0.125, text: 'さや' },
  { t: -7, v: 0.24, text: '針' },
  { t: -16, v: 0.025, text: '厚角板' },
  { t: -16, v: 0.1, text: '骸晶角板' },
  { t: -16, v: 0.175, text: '扇形' },
  { t: -16, v: 0.26, text: '樹枝状' },
  { t: -31, v: 0.025, text: '角柱' },
  { t: -31, v: 0.08, text: '骸晶角柱' },
  { t: -31, v: 0.2, text: 'さや' },
];

// Faint vertical bands for the four temperature regimes.
const BANDS: Array<{ from: number; to: number; color: string }> = [
  { from: 0, to: -4, color: 'rgba(127,180,255,0.05)' },
  { from: -4, to: -10, color: 'rgba(127,180,255,0.10)' },
  { from: -10, to: -22, color: 'rgba(127,180,255,0.06)' },
  { from: -22, to: -40, color: 'rgba(127,180,255,0.11)' },
];

function drawNakaya(): void {
  const w = nakaya.width;
  const h = nakaya.height;
  nctx.clearRect(0, 0, w, h);

  // plot background
  nctx.fillStyle = 'rgba(255,255,255,0.02)';
  nctx.fillRect(PAD.l, PAD.t, w - PAD.l - PAD.r, h - PAD.t - PAD.b);

  // temperature bands
  for (const band of BANDS) {
    const x0 = gx(band.from);
    const x1 = gx(band.to);
    nctx.fillStyle = band.color;
    nctx.fillRect(Math.min(x0, x1), PAD.t, Math.abs(x1 - x0), h - PAD.t - PAD.b);
  }

  // frame
  nctx.strokeStyle = 'rgba(255,255,255,0.18)';
  nctx.lineWidth = 1;
  nctx.strokeRect(PAD.l, PAD.t, w - PAD.l - PAD.r, h - PAD.t - PAD.b);

  // region labels
  nctx.font = '10px system-ui, sans-serif';
  nctx.textAlign = 'center';
  nctx.textBaseline = 'middle';
  for (const r of REGION_LABELS) {
    const active = r.text === currentMorph;
    nctx.fillStyle = active ? '#cfe2ff' : 'rgba(154,166,189,0.65)';
    nctx.font = active ? '600 10px system-ui, sans-serif' : '10px system-ui, sans-serif';
    nctx.fillText(r.text, gx(r.t), gy(r.v));
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
