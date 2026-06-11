import { describe, it, expect } from 'vitest';
import { THREE } from '../three';
import { COLORS } from '../classify';
import {
  buildMorphology,
  DENT_DIMS,
  STELLAR_ARM_PARAMS,
  FERNLIKE_ARM_PARAMS,
  LONG_COLUMN_DIMS,
} from './morphologies';
import { dentedHexOutline } from './hexOutlineBuilder';
import { DENDRITE_ARM_DEFAULTS } from './parts';
import { mulberry32 } from '../random';

// 案 B CP-B3 形態系テスト(設計書 docs/geometry-caseB-design.md §4-4)。
// 対象: 骸晶角柱(C3b)・さや(C2a)・針(C1a)の Box 置換 → 花形断面押し出し。

const DEG = 180 / Math.PI;
const CASE_B_TARGETS = ['骸晶角柱', 'さや', '針'] as const;

function build(morphology: (typeof CASE_B_TARGETS)[number]): THREE.Group {
  return buildMorphology(morphology, mulberry32(42));
}

/** group 配下の全メッシュ(LineSegments を除く)。 */
function meshesOf(group: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
  });
  return out;
}

/** group 配下の全ジオメトリ(メッシュ・ライン両方)。 */
function geometriesOf(group: THREE.Group): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  group.traverse((o) => {
    const g = (o as THREE.Mesh).geometry;
    if (g) out.push(g);
  });
  return out;
}

/** 押し出し柱(ExtrudeGeometry)のメッシュを 1 つだけ持つことを検証して返す。 */
function theExtrudedColumn(group: THREE.Group): THREE.Mesh {
  const hits = meshesOf(group).filter((m) => m.geometry.type === 'ExtrudeGeometry');
  expect(hits).toHaveLength(1);
  return hits[0];
}

/**
 * 押し出し柱の全頂点が「XZ = アウトライン頂点のいずれか・Y = ±height/2」に
 * 一致し、アウトライン 30 点をすべて使うことを検証(§4-4 整合検算)。
 * dentedHexColumn の rotateX(90°) によりアウトライン (x, y) は柱の (x, z) に写る。
 */
function expectColumnMatchesOutline(
  mesh: THREE.Mesh,
  outline: Array<[number, number]>,
  height: number,
): void {
  const pos = mesh.geometry.getAttribute('position');
  const tol = 1e-5; // BufferAttribute は Float32
  const used = new Set<number>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    expect(Math.min(Math.abs(y - height / 2), Math.abs(y + height / 2))).toBeLessThan(tol);
    const idx = outline.findIndex(([ox, oy]) => Math.hypot(x - ox, z - oy) < tol);
    expect(idx).toBeGreaterThanOrEqual(0);
    used.add(idx);
  }
  expect(used.size).toBe(outline.length);
}

/** 針メッシュ(needleRadius = 0.15/√3 の 6 角柱)を抽出。 */
function needleMeshes(group: THREE.Group): THREE.Mesh[] {
  const needleRadius = 0.15 / Math.sqrt(3);
  return meshesOf(group).filter((m) => {
    if (m.geometry.type !== 'CylinderGeometry') return false;
    const p = (m.geometry as THREE.CylinderGeometry).parameters;
    return p.radialSegments === 6 && Math.abs(p.radiusTop - needleRadius) < 1e-9;
  });
}

/** group 配下の全ジオメトリ・マテリアルを dispose。 */
function disposeGroup(group: THREE.Group): void {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) mat.dispose();
  });
}

/** 形状署名: 種別・位置・Y/Z 回転・Cylinder 高さ(seed 決定性の比較用)。 */
function shapeSignature(group: THREE.Group): string {
  const parts: string[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    const params = (m.geometry as THREE.CylinderGeometry | undefined)?.parameters as
      | { height?: number }
      | undefined;
    parts.push(
      [
        o.type,
        m.geometry?.type ?? '-',
        o.position.toArray().map((n) => n.toFixed(12)).join(','),
        o.rotation.y.toFixed(12),
        o.rotation.z.toFixed(12),
        params?.height?.toFixed(12) ?? '-',
      ].join('|'),
    );
  });
  return parts.join('\n');
}

/** 樹枝状族の腕グループ(直下の Group)を取り出す。 */
function armsOf(group: THREE.Group): THREE.Group[] {
  return group.children.filter((c): c is THREE.Group => c.type === 'Group');
}

/** 樹枝状族の中心六角板が共通寸法 CylinderGeometry(0.5, 0.5, 0.2, 6)・COLORS.base であること。 */
function expectDendriteCenter(group: THREE.Group): void {
  const center = group.children[0] as THREE.Mesh;
  expect(center.isMesh).toBe(true);
  const p = (center.geometry as THREE.CylinderGeometry).parameters;
  expect(p.radiusTop).toBe(0.5);
  expect(p.radiusBottom).toBe(0.5);
  expect(p.height).toBe(0.2);
  expect(p.radialSegments).toBe(6);
  expect((center.material as THREE.MeshStandardMaterial).color.getHex()).toBe(
    new THREE.Color(COLORS.base).getHex(),
  );
}

/**
 * 副枝対の検証: [L, R] の順で L = (−0.04, +60°) / R = (+0.04, −60°)
 * (先端外向き・主枝側面に密着 — 符号の対応まで固定する)。
 */
function expectPetalPairs(petals: THREE.Mesh[], expectZ: number[]): void {
  petals.forEach((p, k) => {
    const left = k % 2 === 0;
    expect(p.position.x).toBe(left ? -0.04 : 0.04); // 主枝半幅 0.08/2(二進で厳密)
    expect(p.rotation.z).toBeCloseTo(left ? Math.PI / 3 : -Math.PI / 3, 12); // 先端外向き ±60°
    expect(p.position.z).toBeCloseTo(expectZ[k], 12);
  });
}

describe('案B 形態系 — 骸晶角柱・さや・針(設計書 §4-4)', () => {
  it('a. 3 形態に BoxGeometry が存在しない(骨格/エッジ/側面凹み Box の置換完了)', () => {
    for (const t of CASE_B_TARGETS) {
      const types = geometriesOf(build(t)).map((g) => g.type);
      expect(types).not.toContain('BoxGeometry');
    }
  });

  it('b. 骸晶角柱: コア+リップリング 2 段組 — 頂点整合・窪み床 ±(H/2−lip)・ハイライト床・全高/包絡不変', () => {
    const group = build('骸晶角柱');
    const H = 1.5;
    const lip = 0.15; // 端面の窪み深さ(v1 dentDepth 踏襲)
    const holeRadius = 0.28; // リングの穴(= v1 dentRadius 0.4×0.7)、頂点 = 角方向
    const outline = dentedHexOutline(0.4, DENT_DIMS.skeletal.m, DENT_DIMS.skeletal.w);

    // 旧 沈め六角柱(CylinderGeometry)は撤去済み(実ジオメトリの窪みへ置換)
    expect(meshesOf(group).filter((m) => m.geometry.type === 'CylinderGeometry')).toHaveLength(0);

    const extruded = meshesOf(group).filter((m) => m.geometry.type === 'ExtrudeGeometry');
    expect(extruded).toHaveLength(3);

    // コア(y = 0): 花形断面 30 点・高さ H − 2·lip → 窪み床は y = ±(H/2 − lip)。
    // キャップ材(index 0)= COLORS.highlight(窪み床のハイライト、v1 意匠踏襲)
    const cores = extruded.filter((m) => m.position.y === 0);
    expect(cores).toHaveLength(1);
    expectColumnMatchesOutline(cores[0], outline, H - 2 * lip);
    const coreMats = cores[0].material as THREE.MeshStandardMaterial[];
    expect(Array.isArray(coreMats)).toBe(true);
    expect(coreMats[0].color.getHex()).toBe(new THREE.Color(COLORS.highlight).getHex());

    // 穴六角形の想定頂点(円半径 0.28・角方向 0° + k·60°)。
    // 干渉ガード: 穴 apothem < 凹み床の中心距離 apothem − g
    const g = (Math.sqrt(3) / 2) * DENT_DIMS.skeletal.w;
    expect(holeRadius * Math.cos(Math.PI / 6)).toBeLessThan((Math.sqrt(3) / 2) * 0.4 - g);
    const holePts: Array<[number, number]> = Array.from({ length: 6 }, (_, k) => [
      holeRadius * Math.cos((Math.PI / 3) * k),
      holeRadius * Math.sin((Math.PI / 3) * k),
    ]);

    // リップリング ×2(y = ±(H − lip)/2、ローカル厚み ±lip/2):
    // 外形 = 同花形断面(凹み溝が全高で連続)/ 穴 = 六角形 — 36 柱すべて使用
    const tol = 1e-5;
    const ringTargets = [...outline, ...holePts];
    for (const sign of [1, -1]) {
      const ring = extruded.find((m) => Math.abs(m.position.y - (sign * (H - lip)) / 2) < 1e-9);
      expect(ring).toBeDefined();
      const pos = ring!.geometry.getAttribute('position');
      const used = new Set<number>();
      for (let i = 0; i < pos.count; i++) {
        expect(Math.abs(Math.abs(pos.getY(i)) - lip / 2)).toBeLessThan(tol);
        const idx = ringTargets.findIndex(
          ([ox, oy]) => Math.hypot(pos.getX(i) - ox, pos.getZ(i) - oy) < tol,
        );
        expect(idx).toBeGreaterThanOrEqual(0);
        used.add(idx);
      }
      expect(used.size).toBe(ringTargets.length);
    }

    // 全高 H・外接半径 0.4 の包絡不変(ワールド y = ローカル y + position.y)
    let maxY = 0;
    let maxR = 0;
    for (const m of extruded) {
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        maxY = Math.max(maxY, Math.abs(pos.getY(i) + m.position.y));
        maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getZ(i)));
      }
    }
    expect(maxY).toBeCloseTo(H / 2, 5);
    expect(maxR).toBeCloseTo(0.4, 5);

    // 全周エッジライン(コア + リング ×2)
    expect(geometriesOf(group).filter((geo) => geo.type === 'EdgesGeometry')).toHaveLength(3);
  });

  it('c. さや・針: 中心柱の押し出し頂点が花形断面(sheath 薄肉寸法・R 0.4・H 1.6)と整合、内側透明レイヤー 5 重を踏襲', () => {
    for (const t of ['さや', '針'] as const) {
      const group = build(t);
      const outline = dentedHexOutline(0.4, DENT_DIMS.sheath.m, DENT_DIMS.sheath.w);
      expectColumnMatchesOutline(theExtrudedColumn(group), outline, 2.0 * 0.8);

      // 内側レイヤー(i = 1..5)の CylinderGeometry は不変(針の 12 本は除外)
      const needles = new Set(needleMeshes(group));
      const innerLayers = meshesOf(group).filter(
        (m) => m.geometry.type === 'CylinderGeometry' && !needles.has(m),
      );
      expect(innerLayers).toHaveLength(5);
      for (const layer of innerLayers) {
        expect((layer.material as THREE.MeshStandardMaterial).opacity).toBeCloseTo(0.3, 12);
      }
    }
  });

  it('d. 針 12 本: ワールド頂点方位 − φ_i ≡ 一定 0 (mod 60°)・rotation.y ≡ 0 (mod 60°)', () => {
    const group = build('針');
    const needles = needleMeshes(group);
    expect(needles).toHaveLength(12);

    // 配置角 φ_i は 6 方位(上下ペア)
    const phis = new Set(
      needles.map((m) => Math.round(Math.atan2(m.position.z, m.position.x) * DEG * 1e6) / 1e6),
    );
    expect(phis.size).toBe(6);

    for (const needle of needles) {
      const phiDeg = Math.atan2(needle.position.z, needle.position.x) * DEG;

      // rotation.y = −φ_i + Θ0 ≡ 0 (mod 60°) — 6 回対称により v1 と同一形状(§2.4)
      const rotMod = ((needle.rotation.y * DEG) % 60 + 60) % 60;
      expect(Math.min(rotMod, 60 - rotMod)).toBeLessThan(1e-9);

      // 全リング頂点のワールド方位 − φ_i ≡ 0 (mod 60°)(ファセット方位の radial 整合)
      const pos = needle.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), 0, pos.getZ(i));
        if (v.length() < 1e-6) continue; // キャップ中心頂点を除外
        v.applyQuaternion(needle.quaternion);
        const azDeg = Math.atan2(v.z, v.x) * DEG;
        const diff = (((azDeg - phiDeg) % 60) + 60) % 60;
        expect(Math.min(diff, 60 - diff)).toBeLessThan(1e-4);
      }
    }
  });

  it('e. dispose 正常(3 形態のジオメトリ・マテリアル)', () => {
    for (const t of CASE_B_TARGETS) {
      expect(() => disposeGroup(build(t))).not.toThrow();
    }
  });

  it('f. 同一 seed → 同一形状・別 seed → 別形状(針の乱数長)', () => {
    const sig7a = shapeSignature(buildMorphology('針', mulberry32(7)));
    const sig7b = shapeSignature(buildMorphology('針', mulberry32(7)));
    const sig8 = shapeSignature(buildMorphology('針', mulberry32(8)));
    expect(sig7a).toBe(sig7b);
    expect(sig7a).not.toBe(sig8);
  });
});

describe('案M 形態系 — 星状・羊歯・長柱(設計書 §5)', () => {
  it('g. 樹枝状ビット不変: DENDRITE_ARM_DEFAULTS が現行値リテラルと一致(針 rotation.y 方式)', () => {
    expect(DENDRITE_ARM_DEFAULTS).toEqual({
      mainWidth: 0.08,
      mainLength: 2.1,
      mainThickness: 0.08,
      sideCount: 3,
      sideSpacing: 0.5,
      sideStart: 1.5,
      sideWidth: 0.3,
      sideLength: 0.6,
      sideThickness: 0.05,
    });
  });

  it('h. 樹枝状の構造署名: 中心 1 + 腕 6(各 = 主枝 1 + 副枝 3 対)・offsetZ/±60°/接合 ±0.04 が現行構成と一致', () => {
    const group = buildMorphology('樹枝状', mulberry32(42));
    expectDendriteCenter(group);
    const arms = armsOf(group);
    expect(arms).toHaveLength(6);
    expect(meshesOf(group)).toHaveLength(1 + 6 * 7); // 中心 1 + 腕 6 ×(主枝 1 + 副枝 3 対)

    const expectZ = [0.75, 0.75, 1.25, 1.25, 1.75, 1.75]; // spacing 0.5 × (i + 1.5)
    arms.forEach((arm, i) => {
      expect(arm.rotation.y).toBeCloseTo(-(i * Math.PI) / 3, 12);
      const meshes = arm.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
      expect(meshes).toHaveLength(7);
      meshes.forEach((m) => expect(m.geometry.type).toBe('ExtrudeGeometry'));
      expectPetalPairs(meshes.slice(1), expectZ); // [0] = 主枝、以降 L/R の対(符号まで固定)
    });
  });

  it('i. 星状: 各腕 = 主枝のみ(副枝 0)・主枝ジオメトリは樹枝状とビット同一', () => {
    expect(STELLAR_ARM_PARAMS).toEqual({ sideCount: 0 }); // 最小差分(裁量 2)
    const stellar = buildMorphology('星状', mulberry32(42));
    expectDendriteCenter(stellar);
    const arms = armsOf(stellar);
    expect(arms).toHaveLength(6);
    expect(meshesOf(stellar)).toHaveLength(1 + 6); // 中心 1 + 主枝 6
    arms.forEach((arm, i) => {
      expect(arm.rotation.y).toBeCloseTo(-(i * Math.PI) / 3, 12);
      expect(arm.children).toHaveLength(1);
    });

    // 主枝の押し出し頂点列が樹枝状の主枝と完全一致(寸法共通の機械検証)
    const dendrite = buildMorphology('樹枝状', mulberry32(42));
    const mainOf = (g: THREE.Group) =>
      (armsOf(g)[0].children[0] as THREE.Mesh).geometry.getAttribute('position')
        .array as Float32Array;
    expect(Array.from(mainOf(stellar))).toEqual(Array.from(mainOf(dendrite)));
  });

  it('j. 羊歯: 各腕 = 主枝 1 + 副枝 5 対(offsetZ 0.3〜1.5)・±60°・接合 ±0.04', () => {
    expect(FERNLIKE_ARM_PARAMS).toEqual({
      sideCount: 5,
      sideSpacing: 0.3,
      sideStart: 1.0,
      sideLength: 0.75,
      sideWidth: 0.22,
    }); // 裁量 3(確定は目視ラウンド)
    const group = buildMorphology('羊歯', mulberry32(42));
    expectDendriteCenter(group);
    const arms = armsOf(group);
    expect(arms).toHaveLength(6);
    expect(meshesOf(group)).toHaveLength(1 + 6 * 11); // 中心 1 + 腕 6 ×(主枝 1 + 副枝 5 対)

    const expectZ = [0.3, 0.3, 0.6, 0.6, 0.9, 0.9, 1.2, 1.2, 1.5, 1.5]; // spacing 0.3 × (i + 1.0)
    for (const arm of arms) {
      const meshes = arm.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
      expect(meshes).toHaveLength(11);
      expectPetalPairs(meshes.slice(1), expectZ); // 接合点は主枝半幅(羊歯でも主枝幅は既定)
    }
  });

  it('k. 長柱: R 0.25 / H 2.0(案 1、H/D = 4.0)・6 分割・EdgesGeometry 付き', () => {
    expect(LONG_COLUMN_DIMS).toEqual({ radius: 0.25, height: 2.0 }); // 裁量 4 = 案 1
    const group = buildMorphology('長柱', mulberry32(42));

    const meshes = meshesOf(group);
    expect(meshes).toHaveLength(1);
    const p = (meshes[0].geometry as THREE.CylinderGeometry).parameters;
    expect(p.radiusTop).toBe(LONG_COLUMN_DIMS.radius);
    expect(p.radiusBottom).toBe(LONG_COLUMN_DIMS.radius);
    expect(p.height).toBe(LONG_COLUMN_DIMS.height);
    expect(p.radialSegments).toBe(6);
    expect(p.height / (2 * p.radiusTop)).toBeCloseTo(4.0, 12); // H/D

    const edges = geometriesOf(group).filter((g) => g.type === 'EdgesGeometry');
    expect(edges).toHaveLength(1);
  });

  it('l. 新 3 形態: dispose 正常・同一 seed → 同一形状', () => {
    for (const t of ['星状', '羊歯', '長柱'] as const) {
      expect(() => disposeGroup(buildMorphology(t, mulberry32(7)))).not.toThrow();
      const a = shapeSignature(buildMorphology(t, mulberry32(7)));
      const b = shapeSignature(buildMorphology(t, mulberry32(7)));
      expect(a).toBe(b);
    }
  });
});
