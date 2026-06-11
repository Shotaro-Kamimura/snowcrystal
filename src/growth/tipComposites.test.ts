import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { THREE } from '../three';
import { buildMorphology } from '../geometry/morphologies';
import { mulberry32 } from '../random';
import { disposeCrystal } from '../createSnowCrystal';
import { createCappedColumn } from './cappedColumn';
import { renderGrowthPath } from './renderGrowthPath';
import {
  createTipComposite,
  TIP_ATTACH_RADIUS,
  TIP_PLATE_PARAMS,
  TIP_PETAL_PARAMS,
  TIP_ARM_PARAMS,
  TIP_ARM_EMBED,
} from './tipComposites';
import type { GrowthPath, PathHit } from './types';
import type { Morphology } from '../types';

const path = (a: [number, number], b: [number, number]): GrowthPath => [
  { temperature: a[0], supersaturation: a[1] },
  { temperature: b[0], supersaturation: b[1] },
];

/**
 * フルメッシュ署名(案 K 設計書 §10.6 項 3 — CP-K2 ゲートの MD5 方式の転用)。
 * obj.type + ローカル TRS + geometry.type + 全 BufferAttribute(名前ソート順・
 * バイト列)+ index + マテリアル(type/color/flatShading/transparent/opacity)。
 * userData は含めない(part タグ付与が「ビット」に影響しないことの定義そのもの)。
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
      hash.update(JSON.stringify(geo.groups)); // マテリアル配列の割当(K2 方式への強化)
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

/** 配下の全 Mesh の userData.part を集計するヘルパー。 */
function meshParts(root: THREE.Object3D): string[] {
  const parts: string[] = [];
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) parts.push(String(obj.userData.part));
  });
  return parts;
}

const PHI = (k: number): number => Math.PI / 6 + (k * Math.PI) / 3; // φ_k = 30° + k·60°

describe('P2 系ゴールデンパス(案 K 設計書 §10.6 項 1)', () => {
  it('P2a 系: ① (−15, 0.23) 星状 → ② (−2, 0.05) 角板 ⇒ 角板付枝・小六角板 ×6', () => {
    const group = renderGrowthPath(path([-15, 0.23], [-2, 0.05]));
    const hit = group.userData.pathHit as PathHit;
    expect(hit.stages[0].region.id).toBe('ml66/P1d'); // 星状
    expect(hit.stages[0].morphology).toBe('星状');
    expect(hit.stages[1].morphology).toBe('角板');
    expect(hit.composite?.id).toBe('composite/P2-plate-ends');
    expect(hit.composite?.mlCode).toBe('P2a/P2c');
    expect(hit.composite?.morphology).toBe('角板付枝');
    expect(group.children).toHaveLength(7); // [core, tip×6]
    for (const tip of group.children.slice(1)) {
      expect(tip).toBeInstanceOf(THREE.Mesh); // 小六角板
    }
  });

  // ② は §10.6 設計時推定 (−12, 0.05) から (−12, 0.08) へ実測修正(0.05 は s ≈ 0.26 で
  // C1e 角柱に落ちる。C1g 厚角板 = s ∈ (0.3, 0.5] — 温度・意図(② = 厚角板)は設計どおり)
  it('P2c 系対比: ① (−15, 0.25) 樹枝状 → ② (−12, 0.08) 厚角板 ⇒ 同・中核が ① に追従', () => {
    const group = renderGrowthPath(path([-15, 0.25], [-12, 0.08]), 1);
    const hit = group.userData.pathHit as PathHit;
    expect(hit.stages[0].region.id).toBe('ml66/P1e'); // 樹枝状
    expect(hit.stages[0].morphology).toBe('樹枝状');
    expect(hit.stages[1].morphology).toBe('厚角板');
    expect(hit.composite?.morphology).toBe('角板付枝');
    // 中核 = ① の形態(樹枝状)であることの直接証明(署名一致 — §10.2 の自動区別)
    expect(fullMeshSignature(group.children[0])).toBe(
      fullMeshSignature(buildMorphology('樹枝状', mulberry32(1))),
    );
  });

  it('P2g 系: ① (−2, 0.05) 角板 → ② (−15, 0.25) 樹枝状 ⇒ 枝付角板・終端 = 樹枝腕', () => {
    const group = renderGrowthPath(path([-2, 0.05], [-15, 0.25]));
    const hit = group.userData.pathHit as PathHit;
    expect(hit.stages[0].morphology).toBe('角板');
    expect(hit.stages[1].region.id).toBe('ml66/P1e'); // 樹枝状
    expect(hit.composite?.id).toBe('composite/P2-branched-ends');
    expect(hit.composite?.mlCode).toBe('P2f/P2g');
    expect(hit.composite?.morphology).toBe('枝付角板');
    expect(group.children).toHaveLength(7);
    for (const tip of group.children.slice(1)) {
      // 樹枝腕 = createBranchWithChildren の Group(主枝 1 + 副枝 2 対 = 5 Mesh)
      expect(tip).toBeInstanceOf(THREE.Group);
      expect(tip.children).toHaveLength(1 + 2 * (TIP_ARM_PARAMS.sideCount ?? 0));
    }
  });

  it('P2f 系: ① (−2, 0.05) 角板 → ② (−15, 0.20) 広幅枝 ⇒ 同・終端 = 扇形花弁(②分岐)', () => {
    const group = renderGrowthPath(path([-2, 0.05], [-15, 0.2]));
    const hit = group.userData.pathHit as PathHit;
    expect(hit.stages[0].morphology).toBe('角板');
    expect(hit.stages[1].region.id).toBe('ml66/P1c'); // 広幅枝
    expect(hit.composite?.morphology).toBe('枝付角板');
    expect(group.children).toHaveLength(7);
    for (const tip of group.children.slice(1)) {
      expect(tip).toBeInstanceOf(THREE.Mesh); // 扇形花弁(伸長六角形プリズム)
      expect(tip.rotation.x).toBeCloseTo(Math.PI / 2, 12);
    }
  });
});

describe('構造署名(案 K 設計書 §10.6 項 2)', () => {
  it('children = [core(Group), tip×6] 固定順・全 Mesh の part ∈ {core, tip}・dispose 可', () => {
    const group = createTipComposite('角板付枝', '星状', '角板', 1);
    expect(group.children).toHaveLength(7);
    expect(group.children[0]).toBeInstanceOf(THREE.Group);
    const coreParts = meshParts(group.children[0]);
    expect(coreParts.length).toBeGreaterThan(0);
    expect(new Set(coreParts)).toEqual(new Set(['core']));
    for (const tip of group.children.slice(1)) {
      const tipParts = meshParts(tip);
      expect(tipParts.length).toBeGreaterThan(0);
      expect(new Set(tipParts)).toEqual(new Set(['tip']));
    }
    expect(() => disposeCrystal(createTipComposite('枝付角板', '骸晶角板', '羊歯', 1))).not.toThrow();
  });

  it('小六角板の世界座標 = 規約計算値(φ_k・r = r_attach + r_tip − δ・rotation.y = 0)', () => {
    const group = createTipComposite('角板付枝', '樹枝状', '角板', 1);
    const r = 2.1 + TIP_PLATE_PARAMS.radius - TIP_PLATE_PARAMS.embed; // = 2.4
    for (let k = 0; k < 6; k++) {
      const tip = group.children[k + 1];
      expect(tip.position.x).toBeCloseTo(r * Math.cos(PHI(k)), 12);
      expect(tip.position.y).toBeCloseTo(0, 12);
      expect(tip.position.z).toBeCloseTo(r * Math.sin(PHI(k)), 12);
      expect(tip.rotation.y).toBe(0); // 頂点方位 30°+k·60° の radial 整合(回転不要)
    }
  });

  it('扇形花弁・樹枝腕の世界座標 = 規約計算値(r = r_attach − δ・回転式は既存族と同式)', () => {
    const petals = createTipComposite('枝付角板', '厚角板', '扇形', 1); // r_attach 0.6
    const arms = createTipComposite('枝付角板', '角板', '樹枝状', 1); // r_attach 0.72
    const rPetal = 0.6 - TIP_PETAL_PARAMS.embed;
    const rArm = 0.72 - TIP_ARM_EMBED;
    for (let k = 0; k < 6; k++) {
      const petal = petals.children[k + 1];
      expect(petal.position.x).toBeCloseTo(rPetal * Math.cos(PHI(k)), 12);
      expect(petal.position.y).toBeCloseTo(0, 12);
      expect(petal.position.z).toBeCloseTo(rPetal * Math.sin(PHI(k)), 12);
      expect(petal.rotation.x).toBeCloseTo(Math.PI / 2, 12); // XZ 平面に寝かせ(扇形族と同式)
      expect(petal.rotation.z).toBeCloseTo(PHI(k) - Math.PI / 2, 12); // 長軸 +Y → (cosφ, 0, sinφ)
      const arm = arms.children[k + 1];
      expect(arm.position.x).toBeCloseTo(rArm * Math.cos(PHI(k)), 12);
      expect(arm.position.y).toBeCloseTo(0, 12);
      expect(arm.position.z).toBeCloseTo(rArm * Math.sin(PHI(k)), 12);
      expect(arm.rotation.y).toBeCloseTo(-(PHI(k) - Math.PI / 2), 12); // 腕先端方位 = 90° + angleRad = φ_k
    }
  });

  it('採用定数のリテラル固定(§10.2 — 値変更は意識的なテスト更新を要する)+ 干渉マージン', () => {
    expect(TIP_ATTACH_RADIUS).toEqual({
      樹枝状: 2.1,
      星状: 2.1,
      羊歯: 2.1,
      扇形: 1.52,
      広幅枝: 1.52,
      角板: 0.72,
      厚角板: 0.6,
      骸晶角板: 0.6,
    });
    expect(TIP_PLATE_PARAMS).toEqual({ radius: 0.35, thickness: 0.1, embed: 0.05 });
    expect(TIP_PETAL_PARAMS).toEqual({ scale: 0.6, thickness: 0.1, embed: 0.02 });
    expect(TIP_ARM_PARAMS).toEqual({
      mainLength: 1.2,
      mainWidth: 0.08,
      sideCount: 2,
      sideSpacing: 0.35,
      sideStart: 1.2,
      sideLength: 0.4,
    });
    expect(TIP_ARM_EMBED).toBe(0.02);

    // 隣接終端の干渉判定(§10.2 設計時計算の固定)
    // 小六角板: 隣接中心間距離 = 2·(r_attach + r_tip − δ)·sin30° = r_attach + 0.30
    const plateCenterDist = (rAttach: number): number =>
      2 * (rAttach + TIP_PLATE_PARAMS.radius - TIP_PLATE_PARAMS.embed) * Math.sin(Math.PI / 6);
    expect(plateCenterDist(2.1)).toBeCloseTo(2.4, 12); // 樹枝族 ≫ 2·r_tip = 0.7
    for (const rAttach of [2.1, 1.52]) {
      expect(plateCenterDist(rAttach)).toBeGreaterThan(2 * TIP_PLATE_PARAMS.radius);
    }
    // 扇形花弁(plate 中核の最小 r_attach 0.6): 隣接基部間 0.58 > 花弁幅 0.30
    const petalBaseDist = 2 * (0.6 - TIP_PETAL_PARAMS.embed) * Math.sin(Math.PI / 6);
    expect(petalBaseDist).toBeCloseTo(0.58, 12);
    expect(petalBaseDist).toBeGreaterThan(0.5 * TIP_PETAL_PARAMS.scale);
    // 樹枝腕: 副枝の側方張り出し joinX + sideLength·sin60° < 隣接腕軸間隔の最小(基部 0.58)
    const armSideReach =
      (TIP_ARM_PARAMS.mainWidth ?? 0) / 2 + (TIP_ARM_PARAMS.sideLength ?? 0) * Math.sin(Math.PI / 3);
    expect(armSideReach).toBeLessThan(0.6 - TIP_ARM_EMBED);
  });
});

describe('中核ビット不変(案 K 設計書 §10.6 項 3 — K2 フルメッシュ署名方式の vitest 内比較)', () => {
  const cases: ReadonlyArray<[Morphology, '角板付枝' | '枝付角板', Morphology]> = [
    ['星状', '角板付枝', '角板'],
    ['樹枝状', '角板付枝', '厚角板'],
    ['扇形', '角板付枝', '角板'],
    ['角板', '枝付角板', '樹枝状'],
    ['厚角板', '枝付角板', '扇形'],
  ];
  it.each(cases)(
    '%s 中核: 合成出力の中核サブツリー署名 = buildMorphology(同形態, 同 seed) 単体署名',
    (core, composite, tip) => {
      const group = createTipComposite(composite, core, tip, 1);
      expect(fullMeshSignature(group.children[0])).toBe(
        fullMeshSignature(buildMorphology(core, mulberry32(1))),
      );
    },
  );
});

describe('冠柱回帰(案 K 設計書 §10.6 項 4)', () => {
  it('冠柱パス (−7, 0.03) → (−14, 0.08): renderGrowthPath 出力署名 = createCappedColumn 署名(ビット不変)', () => {
    const group = renderGrowthPath(path([-7, 0.03], [-14, 0.08]), 1);
    expect((group.userData.pathHit as PathHit).composite?.morphology).toBe('冠柱');
    expect(fullMeshSignature(group)).toBe(fullMeshSignature(createCappedColumn(1)));
  });
});

describe('定義域(案 K 設計書 §10.2)', () => {
  it('域外 core(needle-column 系)は throw — 表に無い中核で黙って誤配置しない', () => {
    expect(() => createTipComposite('角板付枝', '角柱', '角板')).toThrow(/attach-radius table/);
    expect(() => createTipComposite('枝付角板', '骸晶角柱', '樹枝状')).toThrow(/attach-radius table/);
    // ② 側の防御(枝付角板の終端が branched 5 形態以外)も同流儀で throw
    expect(() => createTipComposite('枝付角板', '角板', '角柱')).toThrow(/branched-class/);
  });
});
