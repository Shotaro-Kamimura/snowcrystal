import { describe, it, expect } from 'vitest';
import { THREE } from '../three';
import { HexOutlineBuilder, dentedHexOutline } from './hexOutlineBuilder';

type Pt = readonly [number, number];

const DEG = 180 / Math.PI;

/** 正六角形(一辺 s、CCW)を組む: forward + (turnLeft, forward)×5(明示和 +5、t_close = +1)。 */
function buildHexagon(s = 1, b = new HexOutlineBuilder(0)): HexOutlineBuilder {
  b.forward(s);
  for (let i = 0; i < 5; i++) b.turnLeft().forward(s);
  b.close();
  return b;
}

/** 点列の重心。 */
function centroid(pts: Pt[]): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  return [sx / pts.length, sy / pts.length];
}

/** 重心を原点へ平行移動。 */
function centered(pts: Pt[]): Pt[] {
  const [cx, cy] = centroid(pts);
  return pts.map(([x, y]) => [x - cx, y - cy] as const);
}

/** 符号付き面積(shoelace)。CCW で正。 */
function signedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/**
 * 各頂点の内角 [deg]。CCW 多角形で左折頂点 = 120(凸)、右折頂点 = 240(凹)。
 * ウェッジ角(無符号)は両者とも 60° ターンのため常に 120 になることも検証する。
 */
function interiorAnglesSigned(pts: Pt[]): number[] {
  const n = pts.length;
  return pts.map((_, i) => {
    const [px, py] = pts[(i - 1 + n) % n];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[(i + 1) % n];
    const inV = [cx - px, cy - py];
    const outV = [nx - cx, ny - cy];
    const cross = inV[0] * outV[1] - inV[1] * outV[0];
    const dot = inV[0] * outV[0] + inV[1] * outV[1];
    const wedge =
      180 - Math.acos(dot / (Math.hypot(inV[0], inV[1]) * Math.hypot(outV[0], outV[1]))) * DEG;
    expect(Math.abs(wedge - 120)).toBeLessThan(1e-9); // 全頂点のウェッジは 120°
    return cross > 0 ? 120 : 240;
  });
}

/** 各辺方位 [deg](atan2、x 軸基準)の、最寄りの 60° 倍数への距離。 */
function edgeDistToHexSeries(pts: Pt[]): number[] {
  return pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const az = Math.atan2(q[1] - p[1], q[0] - p[0]) * DEG;
    const mod = ((az % 60) + 60) % 60;
    return Math.min(mod, 60 - mod);
  });
}

/** CylinderGeometry(1,1,1,6) の上面リング 6 頂点(x,z)を重複除去で抽出。 */
function cylinderSectionPoints(): Pt[] {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 6);
  const pos = geo.getAttribute('position');
  const seen = new Map<string, Pt>();
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getY(i) - 0.5) > 1e-6) continue;
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (Math.hypot(x, z) < 1e-6) continue; // 上面キャップの中心頂点を除外
    const key = `${Math.round(x * 1e5)},${Math.round(z * 1e5)}`;
    if (!seen.has(key)) seen.set(key, [x, z]);
  }
  geo.dispose();
  return [...seen.values()];
}

describe('HexOutlineBuilder — 交互規則と close 検証(設計書 §1.2–1.3)', () => {
  it('a. 連続 forward は throw', () => {
    const b = new HexOutlineBuilder(0);
    b.forward(1);
    expect(() => b.forward(1)).toThrow(/交互規則/);
  });

  it('b. turn 開始・連続 turn は throw', () => {
    expect(() => new HexOutlineBuilder(0).turnLeft()).toThrow(/交互規則/);
    const b = new HexOutlineBuilder(0);
    b.forward(1).turnLeft();
    expect(() => b.turnRight()).toThrow(/交互規則/);
  });

  it('c. forward の len ≤ 0・非有限は throw', () => {
    for (const len of [0, -1, NaN, Infinity]) {
      expect(() => new HexOutlineBuilder(0).forward(len)).toThrow(/len/);
    }
  });

  it('d. turn 終端での close は throw', () => {
    const b = new HexOutlineBuilder(0);
    b.forward(1).turnLeft();
    expect(() => b.close()).toThrow(/forward で終わる/);
  });

  it('e. t_close ∉ {+1, −1}(d_end = d_start)は throw', () => {
    const b = new HexOutlineBuilder(0);
    b.forward(1).turnLeft().forward(1).turnRight().forward(1); // d_end = 0 = d_start
    expect(() => b.close()).toThrow(/t_close/);
  });

  it('f. Σturn_explicit + t_close ≠ ±6 は throw(ジグザグ)', () => {
    const b = new HexOutlineBuilder(0);
    b.forward(1).turnLeft().forward(1).turnRight().forward(1).turnLeft().forward(1);
    // 明示和 +1、d_end = 1 → t_close = −1 → 合計 0
    expect(() => b.close()).toThrow(/±6 以外/);
  });

  it('g. 位置非閉合は throw(一辺だけ長い六角形)', () => {
    const b = new HexOutlineBuilder(0);
    b.forward(2);
    for (let i = 0; i < 5; i++) b.turnLeft().forward(1);
    expect(() => b.close()).toThrow(/位置が閉じていない/);
  });

  it('h. close 前の points()・close 後の操作は throw', () => {
    const open = new HexOutlineBuilder(0);
    open.forward(1);
    expect(() => open.points()).toThrow(/close\(\) 後にのみ/);
    const closed = buildHexagon();
    expect(() => closed.forward(1)).toThrow(/close\(\) 後の操作/);
    expect(() => closed.turnLeft()).toThrow(/close\(\) 後の操作/);
    expect(() => closed.close()).toThrow(/close\(\) 後の操作/);
  });
});

describe('HexOutlineBuilder — 正六角形ゴールデンと正規化(設計書 §4-2)', () => {
  it('i. CCW 正六角形が CylinderGeometry(…,6) 断面と合同(半径 1・60° 刻み・位相差 30°)', () => {
    const hex = centered(buildHexagon(1).points());
    const cyl = cylinderSectionPoints();

    expect(hex).toHaveLength(6);
    expect(cyl).toHaveLength(6);

    // 半径: builder は厳密(1e-12)、Cylinder は Float32(1e-6)
    for (const [x, y] of hex) expect(Math.abs(Math.hypot(x, y) - 1)).toBeLessThan(1e-12);
    for (const [x, z] of cyl) expect(Math.abs(Math.hypot(x, z) - 1)).toBeLessThan(1e-6);

    // 方位列(昇順)が等差 60°、かつ集合間の位相差が一定 |30°|
    const azHex = hex.map(([x, y]) => Math.atan2(y, x) * DEG).sort((a, b) => a - b);
    const azCyl = cyl.map(([x, z]) => Math.atan2(z, x) * DEG).sort((a, b) => a - b);
    for (let i = 1; i < 6; i++) {
      expect(Math.abs(azHex[i] - azHex[i - 1] - 60)).toBeLessThan(1e-9);
      expect(Math.abs(azCyl[i] - azCyl[i - 1] - 60)).toBeLessThan(1e-4);
    }
    const offsets = azCyl.map((a, i) => a - azHex[i]);
    for (const o of offsets) expect(Math.abs(o - offsets[0])).toBeLessThan(1e-4);
    expect(Math.abs(Math.abs(offsets[0]) - 30)).toBeLessThan(1e-4);
  });

  it('j. CW 定義は CCW へ正規化(符号付き面積 > 0・始点保持)', () => {
    const b = new HexOutlineBuilder(0);
    b.forward(1);
    for (let i = 0; i < 5; i++) b.turnRight().forward(1);
    b.close(); // 明示和 −5 + t_close(−1) = −6(合法)
    const pts = b.points();
    expect(pts).toHaveLength(6);
    expect(signedArea(pts)).toBeGreaterThan(0); // CCW 正規化
    expect(pts[0][0]).toBe(0); // 始点 (0,0) が先頭のまま
    expect(pts[0][1]).toBe(0);
    // CCW 版と同一の頂点集合(順序を除く)
    const ccw = buildHexagon(1, new HexOutlineBuilder(0)).points();
    // CW 六角形は x 軸対称の鏡像位置に展開されるため、集合は y 符号反転で一致
    const mirrored = ccw.map(([x, y]) => [x, -y] as const);
    for (const [mx, my] of mirrored) {
      const hit = pts.some(([x, y]) => Math.hypot(x - mx, y - my) < 1e-12);
      expect(hit).toBe(true);
    }
  });

  it('k. fromAxis(axis, antiparallel) の開始方位は d = 2·axis(+3)', () => {
    const cases: Array<[0 | 1 | 2, boolean, number]> = [
      [0, false, 0],
      [1, false, 120],
      [2, false, 240],
      [0, true, 180],
      [2, true, 60], // (4+3) mod 6 = 1 → 60°
    ];
    for (const [axis, anti, expectedDeg] of cases) {
      const b = HexOutlineBuilder.fromAxis(axis, anti);
      b.forward(1);
      for (let i = 0; i < 5; i++) b.turnLeft().forward(1);
      b.close();
      const [x, y] = b.points()[1]; // 最初の forward 終端 = 開始方位の単位ベクトル
      const az = ((Math.atan2(y, x) * DEG) % 360 + 360) % 360;
      expect(Math.abs(az - expectedDeg) % 360).toBeLessThan(1e-9);
    }
  });
});

describe('dentedHexOutline — 花形断面(設計書 §2.1)', () => {
  const CASES: Array<[number, number, number]> = [
    [0.4, 0.16, 0.08], // §2.1 の寸法目安
    [1, 0.4, 0.2],
  ];

  it('l. 頂点 30・内角列(signed)が {120,240,240,120,120}×6 の巡回', () => {
    for (const [R, m, w] of CASES) {
      const pts = dentedHexOutline(R, m, w);
      expect(pts).toHaveLength(30);
      const angles = interiorAnglesSigned(pts);
      // 始点 = 角頂点のため、設計書の辺ユニット列 {120,240,240,120,120} の
      // 巡回(角 120 → 入口 120 → 凹底 240×2 → 出口 120)で並ぶ
      const pattern = [120, 120, 240, 240, 120];
      angles.forEach((a, i) => expect(a).toBe(pattern[i % 5]));
      // 凹頂点(240°)は 12 個 = 凹み 6 箇所 × 2
      expect(angles.filter((a) => a === 240)).toHaveLength(12);
    }
  });

  it('m. 全辺方位が 60° 系列(mod 60°、誤差 1e-9)', () => {
    for (const [R, m, w] of CASES) {
      for (const d of edgeDistToHexSeries(dentedHexOutline(R, m, w))) {
        expect(d).toBeLessThan(1e-9);
      }
    }
  });

  it('n. 中心 = 原点・60° 回転で自己一致(6 回対称)', () => {
    for (const [R, m, w] of CASES) {
      const pts = dentedHexOutline(R, m, w);
      const [cx, cy] = centroid(pts);
      expect(Math.hypot(cx, cy)).toBeLessThan(1e-12 * R);
      const c = Math.cos(Math.PI / 3);
      const s = Math.sin(Math.PI / 3);
      for (const [x, y] of pts) {
        const rx = x * c - y * s;
        const ry = x * s + y * c;
        const hit = pts.some(([px, py]) => Math.hypot(px - rx, py - ry) < 1e-9 * Math.max(1, R));
        expect(hit).toBe(true);
      }
    }
  });

  it('o. 外形包絡: 角頂点 6 点が半径 R・その他 24 点は R 未満(外向きタブなし)', () => {
    for (const [R, m, w] of CASES) {
      const pts = dentedHexOutline(R, m, w);
      const radii = pts.map(([x, y]) => Math.hypot(x, y));
      const atR = radii.filter((r) => Math.abs(r - R) < 1e-9 * R);
      expect(atR).toHaveLength(6);
      for (const r of radii) expect(r).toBeLessThan(R + 1e-9 * R);
    }
  });

  it('p. パラメタ違反(R/m/w ≤ 0・m + w ≥ R)は throw', () => {
    expect(() => dentedHexOutline(0, 0.1, 0.1)).toThrow(/R must be > 0/);
    expect(() => dentedHexOutline(1, 0, 0.1)).toThrow(/m must be > 0/);
    expect(() => dentedHexOutline(1, 0.1, -1)).toThrow(/w must be > 0/);
    // e = 0 ちょうど(二進で厳密な値を使用。0.4−0.3−0.1 は float 誤差で +2.8e-17 になり境界検証に不適)
    expect(() => dentedHexOutline(1, 0.5, 0.5)).toThrow(/m \+ w < R/);
    expect(() => dentedHexOutline(0.4, 0.35, 0.1)).toThrow(/m \+ w < R/); // e < 0
  });
});
