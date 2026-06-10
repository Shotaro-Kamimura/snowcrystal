// {10-10} 柱面整合の 2D アウトライン生成（氷Ih の結晶学的制約）。
// THREE 非依存の純粋関数のみ。docs/crystallography-audit.md §2 参照。

/**
 * 基底面内の a 軸 3 方向（0°, 60°, 120° の単位ベクトル）。
 * {10-10} 面で囲まれた輪郭のエッジ方位はこの ± 方向（60° 系列）に載る。
 * ドキュメント用定数。
 */
export const A_AXES: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)],
  [Math.cos((2 * Math.PI) / 3), Math.sin((2 * Math.PI) / 3)],
];

/**
 * 伸長六角形のアウトラインを返す（反時計回り）。
 *
 * 原点 = 基部頂点 (0, 0)、長軸 = +Y、先端頂点 = (0, length)。
 * 先端エッジを長軸 ±60° に固定した六角形なので、全内角 120°・対辺平行・
 * 辺方位 {0°, ±60°}（長軸基準、mod 180°）が構成的に保証される。
 *
 * 制約: length > 2t（t = width / (2√3)、先端三角部の高さ）。
 * 違反すると長辺が消失し六角形が成立しないため throw する。
 */
export function elongatedHexOutline(width: number, length: number): Array<[number, number]> {
  if (!(width > 0)) {
    throw new Error(`elongatedHexOutline: width must be > 0 (got ${width})`);
  }
  const t = width / (2 * Math.sqrt(3));
  if (!(length > 2 * t)) {
    throw new Error(
      `elongatedHexOutline: length must exceed 2t = width/√3 (length=${length}, 2t=${2 * t})`,
    );
  }
  const half = width / 2;
  return [
    [0, 0],
    [half, t],
    [half, length - t],
    [0, length],
    [-half, length - t],
    [-half, t],
  ];
}
