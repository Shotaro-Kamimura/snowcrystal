import { THREE } from '../three';
import { COLORS } from '../classify';

// 採用寸法(設計書 §4 の目安どおり。根拠は CP-P3-2 報告を参照)
const R_C = 0.45; // 柱の外接半径
const L_C = 1.6; // 柱の長さ(c 軸方向)
const R_P = 1.1; // キャップ板の外接半径(> R_C)
const T_P = 0.12; // キャップ板の厚み

/**
 * 冠柱(ML66 CP1a)。中央の六角柱 1 本 + 両端の六角板 2 枚(設計書 §4)。
 *
 * - 単結晶: c 軸 = ローカル Y を柱・板で共有し、a 軸方位も共有(回転ねじれなし。
 *   回転双晶冠柱はレアのため対象外)。
 * - 板の中心面 = 柱の端面(y = ±L_c/2)。
 * - children = [柱, 上キャップ, 下キャップ] の固定順。各 Mesh に
 *   userData.part: 'column' | 'cap'(playground のステージ塗り分け用。
 *   パッケージのマテリアルは従来どおり単色系・flatShading)。
 * - seed は受けるが未使用(冠柱は規則形。ジッタは導入しない)。
 *
 * 六角プリズムは CylinderGeometry(…, 6) = {10-10} 柱面・内角 120°(既存の
 * 角柱・角板と同じ規約)。既存 morphologies の六角柱ビルダーは export されて
 * いないため、ここに最小限を実装する(重複解消は 0.3.0 統合時)。
 */
export function createCappedColumn(seed?: number): THREE.Group {
  void seed; // 規則形のため未使用(シグネチャは renderGrowthPath と揃える)

  const group = new THREE.Group();
  const material = () =>
    new THREE.MeshStandardMaterial({ color: COLORS.base, flatShading: true });

  // 柱(c 軸 = ローカル Y、回転なし)
  const column = new THREE.Mesh(new THREE.CylinderGeometry(R_C, R_C, L_C, 6), material());
  column.userData.part = 'column';
  group.add(column);

  // 上下キャップ(板の中心面 = 柱の端面。マテリアルは part 塗り分けのため個別)
  for (const sign of [1, -1] as const) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(R_P, R_P, T_P, 6), material());
    cap.position.y = (sign * L_C) / 2;
    cap.userData.part = 'cap';
    group.add(cap);
  }

  return group;
}
