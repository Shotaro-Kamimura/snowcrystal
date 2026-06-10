// 飽和水蒸気の物理曲線。THREE 非依存の純粋関数(設計書 §2)。

/** 水蒸気の比気体定数 [J/(kg·K)] */
const R_V = 461.5;

/**
 * 氷面の飽和水蒸気圧 [Pa]。
 * Murphy & Koop (2005) の氷面パラメタリゼーション(T は K、T > 110 K で有効)。
 */
function saturationPressureIce(tK: number): number {
  return Math.exp(9.550426 - 5723.265 / tK + 3.53068 * Math.log(tK) - 0.00728332 * tK);
}

/**
 * 過冷却水面の飽和水蒸気圧 [Pa]。
 * Murphy & Koop (2005) の液水パラメタリゼーション(123 K < T < 332 K で有効)。
 */
function saturationPressureWater(tK: number): number {
  return Math.exp(
    54.842763 -
      6763.22 / tK -
      4.21 * Math.log(tK) +
      0.000367 * tK +
      Math.tanh(0.0415 * (tK - 218.8)) *
        (53.878 - 1331.22 / tK - 9.44523 * Math.log(tK) + 0.014025 * tK),
  );
}

/**
 * 水飽和と氷飽和の飽和水蒸気密度差 ρ_ws(T) [g/m³]。
 *
 * ρ_ws = (e_w − e_i) / (R_v · T) · 1000
 *
 * 飽和蒸気圧 e_w(過冷却水)・e_i(氷)は
 * Murphy, D. M., & Koop, T. (2005). Review of the vapour pressures of ice and
 * supercooled water for atmospheric applications. Quarterly Journal of the
 * Royal Meteorological Society, 131(608), 1539–1565. doi:10.1256/qj.04.94
 * のパラメタリゼーションによる。
 *
 * 相対飽和 s = vapor / ρ_ws(T) において s=0 が氷飽和、s=1 が水飽和(設計書 §2)。
 * サニティ: ρ_ws(−15°C) ≈ 0.218 g/m³、極大 ≈ 0.224 g/m³(−12.3°C 付近)。
 */
export function waterSaturationExcessDensity(tempC: number): number {
  const tK = tempC + 273.15;
  return ((saturationPressureWater(tK) - saturationPressureIce(tK)) / (R_V * tK)) * 1000;
}
