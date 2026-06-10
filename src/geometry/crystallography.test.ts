import { describe, it, expect } from 'vitest';
import { elongatedHexOutline } from './crystallography';

type Pt = [number, number];

const DEG = 180 / Math.PI;

/** v 番目の頂点の内角（度）。 */
function interiorAngle(pts: Pt[], v: number): number {
  const prev = pts[(v + pts.length - 1) % pts.length];
  const next = pts[(v + 1) % pts.length];
  const cur = pts[v];
  const u: Pt = [prev[0] - cur[0], prev[1] - cur[1]];
  const w: Pt = [next[0] - cur[0], next[1] - cur[1]];
  const dot = u[0] * w[0] + u[1] * w[1];
  const nu = Math.hypot(u[0], u[1]);
  const nw = Math.hypot(w[0], w[1]);
  return Math.acos(dot / (nu * nw)) * DEG;
}

/** 各辺の方位（度）を長軸 +Y 基準・mod 180° で返す。 */
function edgeAnglesFromAxis(pts: Pt[]): number[] {
  return pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const raw = Math.atan2(q[1] - p[1], q[0] - p[0]) * DEG; // x軸基準
    return ((raw - 90) % 180 + 180) % 180; // +Y(長軸)基準、[0, 180)
  });
}

/** {0°, 60°, 120°} (mod 180°) いずれかへの最小距離。 */
function distToAllowed(angle: number): number {
  const targets = [0, 60, 120, 180];
  return Math.min(...targets.map((t) => Math.abs(angle - t)));
}

const CASES: Array<[number, number]> = [
  [0.3, 0.6],
  [0.8, 2.0],
  [1.0, 1.2],
  [2.0, 7.5],
];

describe('elongatedHexOutline', () => {
  it('a. 全6内角が120°（誤差1e-9）', () => {
    for (const [width, length] of CASES) {
      const pts = elongatedHexOutline(width, length);
      expect(pts).toHaveLength(6);
      for (let v = 0; v < 6; v++) {
        expect(Math.abs(interiorAngle(pts, v) - 120)).toBeLessThan(1e-9);
      }
    }
  });

  it('b. 全辺の方位が長軸に対し {0°, 60°, 120°} mod 180°（誤差1e-9）', () => {
    for (const [width, length] of CASES) {
      const pts = elongatedHexOutline(width, length);
      for (const angle of edgeAnglesFromAxis(pts)) {
        expect(distToAllowed(angle)).toBeLessThan(1e-9);
      }
    }
  });

  it('c. 平行な2長辺の間隔 = width', () => {
    for (const [width, length] of CASES) {
      const pts = elongatedHexOutline(width, length);
      // 長軸に平行（方位0°）な辺を抽出 — 2本あるはず
      const longEdges: Array<[Pt, Pt]> = [];
      pts.forEach((p, i) => {
        const q = pts[(i + 1) % pts.length];
        const angle = edgeAnglesFromAxis(pts)[i];
        if (Math.min(angle, 180 - angle) < 1e-9) longEdges.push([p, q]);
      });
      expect(longEdges).toHaveLength(2);
      // 鉛直線どうしの距離 = x座標差
      const gap = Math.abs(longEdges[0][0][0] - longEdges[1][0][0]);
      expect(Math.abs(gap - width)).toBeLessThan(1e-9);
    }
  });

  it('d. length ≤ 2t で throw する', () => {
    const width = 0.3;
    const t = width / (2 * Math.sqrt(3));
    expect(() => elongatedHexOutline(width, 2 * t)).toThrow(); // 境界（length = 2t）
    expect(() => elongatedHexOutline(width, t)).toThrow(); // 未満
    expect(() => elongatedHexOutline(width, 2 * t + 1e-12)).not.toThrow(); // 直上は成立
  });
});
