import { describe, it, expect } from 'vitest';
import { ML66 } from '../diagram/ml66';
import { REGION_CLASS } from './regionClasses';
import { COMPOSITE_TABLE } from './composites';
import { classifyGrowthPath } from './classifyGrowthPath';
import type { GrowthPath, RegionClass } from './types';

const path = (a: [number, number], b: [number, number]): GrowthPath => [
  { temperature: a[0], supersaturation: a[1] },
  { temperature: b[0], supersaturation: b[1] },
];

describe('REGION_CLASS(設計書 §7-1)', () => {
  it('a. キー集合が ML66.regions と完全一致(過不足なし)', () => {
    const classKeys = Object.keys(REGION_CLASS).sort();
    const regionKeys = Object.keys(ML66.regions).sort();
    expect(classKeys).toEqual(regionKeys);
  });
});

describe('COMPOSITE_TABLE スキーマ(設計書 §7)', () => {
  it('b. id 一意・from/to が RegionClass 値・morphology は 冠柱 か null', () => {
    const classes: RegionClass[] = ['needle-column', 'plate', 'branched', 'polycrystal'];
    const ids = COMPOSITE_TABLE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(COMPOSITE_TABLE).toHaveLength(6);
    for (const e of COMPOSITE_TABLE) {
      expect(classes).toContain(e.from);
      expect(classes).toContain(e.to);
      expect(e.morphology === '冠柱' || e.morphology === null, e.id).toBe(true);
    }
  });
});

describe('classifyGrowthPath ゴールデン(設計書 §7-2、点は実測確定済み)', () => {
  it('c. 柱→板 = 冠柱 CP1a: (−7, 0.03) → (−14, 0.08)', () => {
    const hit = classifyGrowthPath(path([-7, 0.03], [-14, 0.08]));
    expect(hit.stages[0].region.id).toBe('ml66/C1e'); // 角柱
    expect(hit.stages[1].region.id).toBe('ml66/C1g'); // 厚角板
    expect(hit.composite?.id).toBe('composite/CP1a');
    expect(hit.composite?.mlCode).toBe('CP1a');
    expect(hit.composite?.morphology).toBe('冠柱');
  });

  it('c. 枝→柱 = CP3: (−15, 0.20) → (−6, 0.10)', () => {
    const hit = classifyGrowthPath(path([-15, 0.2], [-6, 0.1]));
    expect(hit.stages[0].region.id).toBe('ml66/P1c'); // 広幅枝(branched)
    expect(hit.stages[1].region.id).toBe('ml66/C1f'); // 骸晶角柱
    expect(hit.composite?.id).toBe('composite/CP3-from-branched');
    expect(hit.composite?.mlCode).toBe('CP3');
    expect(hit.composite?.morphology).toBeNull();
  });

  it('c. branched→plate = P2a/P2c: (−15, 0.25) → (−14, 0.12)', () => {
    const hit = classifyGrowthPath(path([-15, 0.25], [-14, 0.12]));
    expect(hit.stages[0].region.id).toBe('ml66/P1e'); // 樹枝状
    expect(hit.stages[1].region.id).toBe('ml66/P1a'); // 角板
    expect(hit.composite?.mlCode).toBe('P2a/P2c');
  });

  it('c. plate→branched = P2f/P2g: (−14, 0.12) → (−15, 0.25)', () => {
    const hit = classifyGrowthPath(path([-14, 0.12], [-15, 0.25]));
    expect(hit.stages[0].region.id).toBe('ml66/P1a');
    expect(hit.stages[1].region.id).toBe('ml66/P1e');
    expect(hit.composite?.mlCode).toBe('P2f/P2g');
  });

  it('c. 同クラス(branched→branched)= null: (−15, 0.25) → (−13, 0.22)', () => {
    const hit = classifyGrowthPath(path([-15, 0.25], [-13, 0.22]));
    expect(hit.stages[0].region.id).toBe('ml66/P1e');
    expect(hit.stages[1].region.id).toBe('ml66/P1c');
    expect(hit.composite).toBeNull();
  });

  it('c. polycrystal を含むパス = null: (−23, 0.25) → (−14, 0.08)', () => {
    const hit = classifyGrowthPath(path([-23, 0.25], [-14, 0.08]));
    expect(hit.stages[0].region.id).toBe('ml66/C2a'); // 砲弾集合
    expect(hit.stages[1].region.id).toBe('ml66/C1g');
    expect(hit.composite).toBeNull();
  });
});

describe('パス長の制約(設計書 §7-3)', () => {
  it('d. length 0 / 1 / 3 は明示 throw', () => {
    const s = { temperature: -10, supersaturation: 0.1 };
    expect(() => classifyGrowthPath([])).toThrow(/2-stage/);
    expect(() => classifyGrowthPath([s])).toThrow(/2-stage/);
    expect(() => classifyGrowthPath([s, s, s])).toThrow(/2-stage/);
  });
});
