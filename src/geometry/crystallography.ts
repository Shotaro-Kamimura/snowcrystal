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
 * 多結晶雪結晶の成分間 c 軸角の CSL(一致格子)双晶角 [deg]。
 *
 * 出典: Kobayashi, Furukawa, Takahashi & Uyeda (1976) "Cubic structure models
 * at the junctions in polycrystalline snow crystals", J. Crystal Growth 35,
 * 262–268 — 接合部に立方晶構造を持つ双晶モデル。CSL 理論の系譜では低エネルギー
 * 境界として 70.3°/[11-20](a 軸まわり 70.3° 回転)が導かれ、−20°C 以深の
 * 交差板結晶(2〜4 枚の基底面薄板)はこの粒界沿いに延びると報告されている。
 *
 * 立方晶接合モデルの理想角は四面体角 acos(1/3) ≈ 70.53°。CSL の近一致計算では
 * 70.3° となり、本パッケージはこちらを採用する。
 */
export const CSL_TWIN_ANGLE_DEG = 70.3;

/**
 * 正六角形(外接半径 R)を長対角線で半裁した四角形のアウトライン(反時計回り)。
 *
 * スパイン辺 = 長対角線(長さ 2R)で、方向は a 軸 A_AXES[0]([1, 0])、中点 = 原点。
 * フィンは +y 側へ張り出し、外周 3 辺は {10-1̄0} 柱面トレース(辺方位は 60° 系列)。
 * 内角列は 60° / 120° / 120° / 60°。
 */
export function halfHexOutline(circumradius: number): Array<[number, number]> {
  if (!(circumradius > 0)) {
    throw new Error(`halfHexOutline: circumradius must be > 0 (got ${circumradius})`);
  }
  const s = (Math.sqrt(3) / 2) * circumradius;
  return [
    [circumradius, 0],
    [circumradius / 2, s],
    [-circumradius / 2, s],
    [-circumradius, 0],
  ];
}

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
