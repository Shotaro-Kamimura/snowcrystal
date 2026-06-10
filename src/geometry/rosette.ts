// 砲弾集合(C2a)の腕方位サンプリング。THREE 非依存の純粋関数
// (docs/phase2-step3-bullet-design.md §3)。

export type Vec3 = readonly [number, number, number];

const SQRT3 = Math.sqrt(3);
const T = 1 / SQRT3;

/**
 * 棄却サンプリング失敗時の正準配置(本数 3〜6)。すべて単位ベクトル。
 * 3 = 三脚(正四面体配置から1本除いた3本、相互角 ≈109.47°)
 * 4 = 正四面体(相互角 ≈109.47°)
 * 5 = 三方両錐(赤道3本 120° + 軸2本)
 * 6 = 八面体(±x, ±y, ±z)
 */
export const CANONICAL_ROSETTE_AXES: Readonly<Record<3 | 4 | 5 | 6, readonly Vec3[]>> = {
  3: [
    [T, T, T],
    [T, -T, -T],
    [-T, T, -T],
  ],
  4: [
    [T, T, T],
    [T, -T, -T],
    [-T, T, -T],
    [-T, -T, T],
  ],
  5: [
    [1, 0, 0],
    [-0.5, 0, SQRT3 / 2],
    [-0.5, 0, -SQRT3 / 2],
    [0, 1, 0],
    [0, -1, 0],
  ],
  6: [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ],
};

/** 最小相互角 [rad](設計書 §3: 全ペア ≥ 50°)。 */
const MIN_MUTUAL_ANGLE_RAD = (50 * Math.PI) / 180;

/** 棄却サンプリングの候補ドロー上限。到達時は正準配置にフォールバック。 */
const MAX_DRAWS = 200;

/** 単位球上の一様乱数方向。 */
function randomUnitVector(rng: () => number): Vec3 {
  const y = 2 * rng() - 1; // cos(極角) を一様に
  const phi = 2 * Math.PI * rng();
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  return [r * Math.cos(phi), y, r * Math.sin(phi)];
}

/**
 * 砲弾集合の腕軸ベクトル列をシード乱数で生成する。
 *
 * - count 省略時は rng で本数を 3〜6 から一様に決定。
 * - 単位球上の一様乱数方向を棄却サンプリング(既採択の全軸と相互角 ≥ 50° の候補のみ採択)。
 * - 候補ドローが上限(200 回)に達したら該当本数の正準配置にフォールバック。
 *
 * 同一 rng 状態(= 同一 seed)からは同一の軸列が得られる(決定性)。
 */
export function sampleRosetteAxes(rng: () => number, count?: number): Vec3[] {
  const n = (
    count === undefined ? 3 + Math.floor(rng() * 4) : Math.min(6, Math.max(3, Math.floor(count)))
  ) as 3 | 4 | 5 | 6;

  const maxDot = Math.cos(MIN_MUTUAL_ANGLE_RAD);
  const axes: Vec3[] = [];
  for (let draws = 0; draws < MAX_DRAWS && axes.length < n; draws++) {
    const v = randomUnitVector(rng);
    const tooClose = axes.some((a) => a[0] * v[0] + a[1] * v[1] + a[2] * v[2] > maxDot);
    if (!tooClose) axes.push(v);
  }
  if (axes.length < n) {
    return [...CANONICAL_ROSETTE_AXES[n]];
  }
  return axes;
}
