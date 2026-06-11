import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { THREE } from '../three';
import { A_AXES, CSL_TWIN_ANGLE_DEG, halfHexOutline } from './crystallography';
import { SIDE_PLANE_OFFSETS_DEG, SIDE_PLANES_DEFAULTS, sampleSidePlaneLayout } from './parts';
import { buildMorphology, SCALELIKE_SIDE_PLANE_PARAMS } from './morphologies';
import { mulberry32 } from '../random';
import { createSnowCrystal, disposeCrystal } from '../createSnowCrystal';

const DEG = 180 / Math.PI;

type Pt = [number, number];

function interiorAngleDeg(pts: Pt[], v: number): number {
  const prev = pts[(v + pts.length - 1) % pts.length];
  const next = pts[(v + 1) % pts.length];
  const cur = pts[v];
  const u = [prev[0] - cur[0], prev[1] - cur[1]];
  const w = [next[0] - cur[0], next[1] - cur[1]];
  const dot = u[0] * w[0] + u[1] * w[1];
  return Math.acos(dot / (Math.hypot(u[0], u[1]) * Math.hypot(w[0], w[1]))) * DEG;
}

function minCircularGapDeg(angles: number[]): number {
  const sorted = [...angles].sort((a, b) => a - b);
  let min = 360 - sorted[sorted.length - 1] + sorted[0];
  for (let i = 0; i + 1 < sorted.length; i++) {
    min = Math.min(min, sorted[i + 1] - sorted[i]);
  }
  return min;
}

describe('halfHexOutline(設計書 §7-1)', () => {
  it('a. 内角列 60/120/120/60・スパイン辺長 = 2R・スパインが a 軸方向', () => {
    for (const R of [1, 0.85, 2]) {
      const pts = halfHexOutline(R);
      expect(pts).toHaveLength(4);

      const angles = pts.map((_, i) => interiorAngleDeg(pts, i));
      const expected = [60, 120, 120, 60];
      angles.forEach((a, i) => expect(Math.abs(a - expected[i]), `R=${R} 頂点${i}`).toBeLessThan(1e-6));

      // スパイン辺 = 最終頂点 → 先頭頂点(閉路辺)
      const spine = [pts[0][0] - pts[3][0], pts[0][1] - pts[3][1]];
      const len = Math.hypot(spine[0], spine[1]);
      expect(Math.abs(len - 2 * R)).toBeLessThan(1e-12);

      // 方向が a 軸 A_AXES[0] = [1, 0] と一致
      const dot = (spine[0] / len) * A_AXES[0][0] + (spine[1] / len) * A_AXES[0][1];
      expect(Math.abs(dot - 1)).toBeLessThan(1e-12);
    }
  });
});

describe('CSL_TWIN_ANGLE_DEG(設計書 §7-2)', () => {
  it('b. 定義値 70.3(±1e-9)', () => {
    expect(Math.abs(CSL_TWIN_ANGLE_DEG - 70.3)).toBeLessThan(1e-9);
  });

  it('b. オフセット規定集合が 7 要素 {0, ±70.3, ±109.7, ±140.6}', () => {
    const sorted = [...SIDE_PLANE_OFFSETS_DEG].sort((a, b) => a - b);
    expect(sorted).toEqual([-140.6, -109.7, -70.3, 0, 70.3, 109.7, 140.6]);
  });
});

describe('sampleSidePlaneLayout(設計書 §7-3)', () => {
  it('c. 決定性: 同一 seed → 完全一致、別 seed(42 vs 7)→ 相違', () => {
    const a = sampleSidePlaneLayout(mulberry32(42));
    const b = sampleSidePlaneLayout(mulberry32(42));
    expect(b).toEqual(a);

    // 実測確認済み: seed 42 → 6枚 / seed 7 → 4枚(配置列も相違)
    const other = sampleSidePlaneLayout(mulberry32(7));
    expect(other).not.toEqual(a);
  });

  it('c. 固定 seed 数件: 本数 ∈ [4,7]・最小角間隔 ≥ 20°・オフセットが規定集合の要素', () => {
    for (const seed of [1, 2, 3, 7, 42, 123, 2024]) {
      const fins = sampleSidePlaneLayout(mulberry32(seed));
      expect(fins.length, `seed ${seed} 本数`).toBeGreaterThanOrEqual(4);
      expect(fins.length, `seed ${seed} 本数`).toBeLessThanOrEqual(7);
      expect(
        minCircularGapDeg(fins.map((f) => f.angleDeg)),
        `seed ${seed} 最小角間隔`,
      ).toBeGreaterThanOrEqual(20 - 1e-9);
      for (const fin of fins) {
        // 全 seed で案B成立(フォールバックなし)を実測確認済み → null でないこと
        expect(fin.baseOffsetDeg, `seed ${seed} オフセット`).not.toBeNull();
        expect(
          SIDE_PLANE_OFFSETS_DEG.some((o) => Math.abs(o - fin.baseOffsetDeg!) < 1e-9),
          `seed ${seed} オフセット ${fin.baseOffsetDeg} が規定集合外`,
        ).toBe(true);
        expect(fin.radiusScale).toBeGreaterThanOrEqual(0.8);
        expect(fin.radiusScale).toBeLessThanOrEqual(1.2);
        expect(Math.abs(fin.staggerRatio)).toBeLessThanOrEqual(0.4);
      }
      // オフセットの重複なし
      const offsets = fins.map((f) => f.baseOffsetDeg);
      expect(new Set(offsets).size).toBe(offsets.length);
    }
  });

  it('c. N=7 でも案Bが成立する(±140.6 拡張の確認、seed 123)', () => {
    const fins = sampleSidePlaneLayout(mulberry32(123));
    expect(fins).toHaveLength(7);
    expect(fins.every((f) => f.baseOffsetDeg !== null)).toBe(true);
  });
});

describe('側面スモーク(設計書 §7-4)', () => {
  it('d. createSnowCrystal({morphology:側面, seed:42}) が Group を返し dispose 可能', () => {
    const group = createSnowCrystal({ morphology: '側面', seed: 42 });
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children.length).toBeGreaterThanOrEqual(4);
    expect(group.children.length).toBeLessThanOrEqual(7);
    expect(() => disposeCrystal(group)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 案 K(CP-K5)— 鱗状側面(S2 仮実装)・側面族(設計書 §4.2)
// ─────────────────────────────────────────────────────────────────────────

/**
 * フルメッシュ署名(CP-K2 ゲートの MD5 方式 — tipComposites.test.ts と同一実装)。
 * obj.type + ローカル TRS + geometry.type + 全 BufferAttribute(名前ソート順・
 * バイト列)+ index + マテリアル(type/color/flatShading/transparent/opacity)。
 */
function fullMeshSignature(root: THREE.Object3D): string {
  const hash = createHash('md5');
  root.traverse((obj) => {
    hash.update(
      [
        obj.type,
        obj.position.toArray().join(','),
        obj.rotation.toArray().join(','),
        obj.scale.toArray().join(','),
      ].join('|'),
    );
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      const geo = mesh.geometry as THREE.BufferGeometry;
      hash.update(geo.type);
      hash.update(JSON.stringify(geo.groups));
      for (const name of Object.keys(geo.attributes).sort()) {
        const attr = geo.getAttribute(name) as THREE.BufferAttribute;
        hash.update(name);
        hash.update(new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength));
      }
      if (geo.index) {
        const arr = geo.index.array;
        hash.update(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
      }
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial;
      hash.update(
        [m.type, std.color?.getHexString() ?? '-', std.flatShading ?? '-', std.transparent, std.opacity].join(
          '|',
        ),
      );
    }
  });
  return hash.digest('hex');
}

describe('案K K-b — 側面ビット不変(族化の機械証明、設計書 §4.2)', () => {
  it('e. SIDE_PLANES_DEFAULTS が現行値リテラルと一致(DENDRITE_ARM_DEFAULTS 方式)', () => {
    // 値の変更は見た目回帰。countRange [4,7]・staggerSpan 0.4・radiusBase 0.9 は
    // 族化前のハードコード値そのもの
    expect(SIDE_PLANES_DEFAULTS).toEqual({
      radiusBase: 0.9,
      countRange: [4, 7],
      staggerSpan: 0.4,
    });
  });

  it('f. 側面フルメッシュ署名: 族化前ゴールデン(HEAD bac2534 で捕獲)と完全一致(seed 1/7/42)', () => {
    // 族化(countRange/staggerSpan の既定マージ)が側面の出力を 1 ビットも
    // 変えないことの直接証明。ゴールデンは実装変更前の HEAD bac2534 上で
    // 同一の署名関数により捕獲した MD5
    const golden: Record<number, string> = {
      1: '671e7a49f06f9cfea8619af73cb28de8',
      7: '01ed14f30fe44c1a6487807c8753d646',
      42: 'f36bb0ccdcb60f7682860e5d1f68a5df',
    };
    for (const [seed, md5] of Object.entries(golden)) {
      expect(
        fullMeshSignature(buildMorphology('側面', mulberry32(Number(seed)))),
        `seed ${seed}`,
      ).toBe(md5);
    }
  });
});

describe('案K K-b — 鱗状側面(S2 仮実装、設計書 §4.2〜§4.3)', () => {
  it('g. SCALELIKE_SIDE_PLANE_PARAMS が設計値リテラルと一致(小型 0.5・密 [6,7]・スタッガ ±0.9)', () => {
    expect(SCALELIKE_SIDE_PLANE_PARAMS).toEqual({
      radiusBase: 0.5,
      countRange: [6, 7],
      staggerSpan: 0.9,
    });
  });

  it('h. 鱗状レイアウト: 本数 6〜7・オフセットは CSL 規定集合(不変アンカー)・|スタッガ| ≤ 0.9', () => {
    for (const seed of [1, 2, 3, 7, 42, 123, 2024]) {
      const fins = sampleSidePlaneLayout(
        mulberry32(seed),
        SCALELIKE_SIDE_PLANE_PARAMS.count,
        SCALELIKE_SIDE_PLANE_PARAMS,
      );
      expect(fins.length, `seed ${seed} 本数`).toBeGreaterThanOrEqual(6);
      expect(fins.length, `seed ${seed} 本数`).toBeLessThanOrEqual(7);
      for (const fin of fins) {
        // 二面角の CSL 70.3° アンカーは S1 と共通(結晶学アンカーは仮にしない — §4.2)
        expect(fin.baseOffsetDeg, `seed ${seed} オフセット`).not.toBeNull();
        expect(
          SIDE_PLANE_OFFSETS_DEG.some((o) => Math.abs(o - fin.baseOffsetDeg!) < 1e-9),
          `seed ${seed} オフセット ${fin.baseOffsetDeg} が規定集合外`,
        ).toBe(true);
        expect(Math.abs(fin.staggerRatio)).toBeLessThanOrEqual(0.9);
      }
    }
  });

  it('i. スタッガ拡大が実効(|ratio| > 0.4 のフィンが存在 — 鱗の軸方向の重なり表現)', () => {
    // 全シードのどこかで旧振幅 0.4 を超えること(スパンが実際に広がった証拠)
    const anyExpanded = [1, 2, 3, 7, 42, 123, 2024].some((seed) =>
      sampleSidePlaneLayout(mulberry32(seed), undefined, SCALELIKE_SIDE_PLANE_PARAMS).some(
        (fin) => Math.abs(fin.staggerRatio) > 0.4,
      ),
    );
    expect(anyExpanded).toBe(true);
  });

  it('j. 鱗状側面の構造署名: レイアウト再生と一致(rotation.y = 二面角・position.y = ratio×0.5)', () => {
    const group = buildMorphology('鱗状側面', mulberry32(42));
    const fins = sampleSidePlaneLayout(mulberry32(42), undefined, SCALELIKE_SIDE_PLANE_PARAMS);
    const meshes = group.children as THREE.Mesh[];
    expect(meshes).toHaveLength(fins.length);
    meshes.forEach((mesh, i) => {
      expect((mesh as THREE.Mesh).geometry.type).toBe('ExtrudeGeometry'); // 半六角薄板(フィン形状不変)
      expect(mesh.rotation.y).toBeCloseTo((fins[i].angleDeg * Math.PI) / 180, 12);
      expect(mesh.position.y).toBeCloseTo(fins[i].staggerRatio * 0.5, 12); // radiusBase 0.5
    });
  });

  it('k. 鱗状側面は側面と同シードで別形状・同シード同士は決定的・dispose 正常', () => {
    expect(fullMeshSignature(buildMorphology('鱗状側面', mulberry32(42)))).not.toBe(
      fullMeshSignature(buildMorphology('側面', mulberry32(42))),
    );
    expect(fullMeshSignature(buildMorphology('鱗状側面', mulberry32(7)))).toBe(
      fullMeshSignature(buildMorphology('鱗状側面', mulberry32(7))),
    );
    const group = createSnowCrystal({ morphology: '鱗状側面', seed: 42 });
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children.length).toBeGreaterThanOrEqual(6);
    expect(group.children.length).toBeLessThanOrEqual(7);
    expect(() => disposeCrystal(group)).not.toThrow();
  });
});
