import { describe, it, expect } from 'vitest';
import { THREE } from '../three';
import { createCappedColumn } from './cappedColumn';
import { renderGrowthPath } from './renderGrowthPath';
import { disposeCrystal } from '../createSnowCrystal';
import type { PathHit } from './types';

type HexParams = { radiusTop: number; height: number };

function params(mesh: THREE.Object3D): HexParams {
  return ((mesh as THREE.Mesh).geometry as THREE.CylinderGeometry).parameters as HexParams;
}

function positions(group: THREE.Group): number[] {
  const out: number[] = [];
  group.traverse((obj) => {
    const geo = (obj as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!geo) return;
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) out.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  });
  return out;
}

describe('createCappedColumn(設計書 §7-4)', () => {
  const group = createCappedColumn();
  const [column, capTop, capBottom] = group.children;

  it('部品 3・固定順・userData.part = [column, cap, cap]', () => {
    expect(group.children).toHaveLength(3);
    expect(group.children.map((c) => c.userData.part)).toEqual(['column', 'cap', 'cap']);
  });

  it('キャップ中心 y = ±L_c/2(板の中心面 = 柱の端面)', () => {
    const halfL = params(column).height / 2;
    expect(capTop.position.y).toBeCloseTo(halfL, 12);
    expect(capBottom.position.y).toBeCloseTo(-halfL, 12);
    expect(column.position.y).toBe(0);
  });

  it('R_p > R_c(キャップ板の方が太い)', () => {
    expect(params(capTop).radiusTop).toBeGreaterThan(params(column).radiusTop);
    expect(params(capBottom).radiusTop).toBe(params(capTop).radiusTop);
  });

  it('柱・板とも回転なし(c 軸 = Y・a 軸方位を共有、ねじれなし)', () => {
    for (const mesh of group.children) {
      expect(mesh.rotation.x).toBe(0);
      expect(mesh.rotation.y).toBe(0);
      expect(mesh.rotation.z).toBe(0);
    }
  });

  it('disposeCrystal が例外なく通る', () => {
    expect(() => disposeCrystal(createCappedColumn())).not.toThrow();
  });

  it('同一入力 → 同一形状(頂点一致)、seed 値を変えても同一(規則形・未使用)', () => {
    const a = positions(createCappedColumn());
    const b = positions(createCappedColumn());
    const c = positions(createCappedColumn(1));
    const d = positions(createCappedColumn(2));
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(d).toEqual(a);
  });
});

describe('renderGrowthPath(設計書 §6)', () => {
  it('冠柱パス (−7, 0.03) → (−14, 0.08): 部品3 + pathHit.composite.mlCode = CP1a', () => {
    const group = renderGrowthPath([
      { temperature: -7, supersaturation: 0.03 },
      { temperature: -14, supersaturation: 0.08 },
    ]);
    expect(group.children).toHaveLength(3);
    expect(group.children.map((c) => c.userData.part)).toEqual(['column', 'cap', 'cap']);
    const pathHit = group.userData.pathHit as PathHit;
    expect(pathHit.composite?.mlCode).toBe('CP1a');
    expect(pathHit.composite?.morphology).toBe('冠柱');
  });

  it('同クラスパス (−15, 0.25) → (−13, 0.22): composite null・冠柱 group でなく広幅枝へ委譲', () => {
    const group = renderGrowthPath([
      { temperature: -15, supersaturation: 0.25 },
      { temperature: -13, supersaturation: 0.22 },
    ]);
    const pathHit = group.userData.pathHit as PathHit;
    expect(pathHit.composite).toBeNull();
    // 最終ステージ P1c の描画形態 = 広幅枝(案 K K-a で扇形近似を解消。
    // 扇形族のため構成は同じ: 中心六角柱 + 花弁6 = children 7)
    expect(pathHit.stages[1].region.id).toBe('ml66/P1c');
    expect(pathHit.stages[1].morphology).toBe('広幅枝');
    expect(group.children).toHaveLength(7);
    expect(group.children[0].userData.part).toBeUndefined();
  });
});
