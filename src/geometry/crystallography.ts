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

/** 氷 Ih の格子定数 a [Å]（Petrenko & Whitworth, Physics of Ice, 1999） */
export const ICE_A_ANGSTROM = 4.518;

/** 氷 Ih の格子定数 c [Å]（Petrenko & Whitworth, Physics of Ice, 1999） */
export const ICE_C_ANGSTROM = 7.356;

/** 軸比 c/a ≈ 1.628。{10-1̄1} 錐面・六角錐高さの導出に使う。 */
export const ICE_C_OVER_A = ICE_C_ANGSTROM / ICE_A_ANGSTROM;

/**
 * {10-1̄1} 錐面が c 軸（柱軸）となす角 [rad]。
 *
 * tan(錐面と軸のなす角) = √3·a / (2c) → ≈ 28.0°
 *
 * 錐面の法線が c 軸となす角（= 錐面と基底面 (0001) の二面角）は補角の ≈ 62.0°。
 * 格子定数の出典: Petrenko & Whitworth, Physics of Ice (1999)。
 */
export const PYRAMID_FACE_ANGLE_FROM_AXIS_RAD = Math.atan(
  (Math.sqrt(3) * ICE_A_ANGSTROM) / (2 * ICE_C_ANGSTROM),
);

/**
 * 外接半径 R の {10-1̄1} 六角錐がシャープに閉じるときの apex 高さ h = R·(c/a) ≈ 1.628R。
 *
 * 導出: 錐面は柱面 {10-1̄0} の上端エッジ（アポセム R√3/2）から軸へ内傾 28.0° で閉じるため、
 * h = (R√3/2) / tan(28.0°) = (R√3/2) · (2c)/(√3·a) = R·c/a。
 */
export function hexPyramidApexHeight(circumradius: number): number {
  return circumradius * ICE_C_OVER_A;
}

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
