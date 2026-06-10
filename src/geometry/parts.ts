import { THREE } from '../three';
import { COLORS } from '../classify';
import { elongatedHexOutline } from './crystallography';

// Geometry part builders. Originally ported from the snownotes viewer
// (main-fixed.js); the remaining builders are crystallography-based
// reimplementations on top of src/geometry/crystallography.ts.

/** elongatedHexOutline を押し出した伸長六角形プリズム（原点 = 基部頂点、長軸 = +Y）。 */
export function createElongatedHexPrism(
  width: number,
  length: number,
  thickness: number,
): THREE.Mesh {
  const outline = elongatedHexOutline(width, length);
  const shape = new THREE.Shape();
  shape.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    shape.lineTo(outline[i][0], outline[i][1]);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.translate(0, 0, -thickness / 2); // 厚み中心合わせ

  const material = new THREE.MeshStandardMaterial({ color: COLORS.wing, flatShading: true });
  return new THREE.Mesh(geometry, material);
}

export function createBranchWithChildren(angleRad: number): THREE.Group {
  const group = new THREE.Group();

  // 主枝（伸長六角形プリズム: 先端120°ファセット）。基部頂点 = 原点で中心柱内に隠れ、
  // 長さ2.1により先端 z=2.1 が最外副枝の先端 z=2.05 を 0.05 リードする
  const mainBranch = createElongatedHexPrism(0.08, 2.1, 0.08);
  mainBranch.rotation.x = Math.PI / 2; // XZ平面に寝かせ、長軸 = +Z

  group.add(mainBranch);

  // 副枝の数と間隔
  const sideCount = 3;
  const spacing = 0.5;
  const joinX = 0.04; // 主枝（伸長六角形プリズム width 0.08）の半幅 = 主枝平行側面上の接合点

  for (let i = 0; i < sideCount; i++) {
    const offsetZ = spacing * (i + 1.5);

    // 左右の副枝（伸長六角形プリズム: 全内角120°・対辺平行）
    const petalL = createElongatedHexPrism(0.3, 0.6, 0.05);
    const petalR = createElongatedHexPrism(0.3, 0.6, 0.05);

    // XZ平面上に寝かせ、長軸の先端を主枝の先端側（外向き）へ±60°で開く
    // （結晶学的に副枝は隣接a軸に平行 = 主枝に対し±60°、開き120°）。
    // 原点 = 基部頂点なので position が接合点そのもの。基部の片エッジは
    // 長軸-60°側にあり、±60°回転後は主枝側面と平行に密着する
    petalL.rotation.x = Math.PI / 2;
    petalL.rotation.z = Math.PI / 3; // 先端方向 (-sin60°, 0, +cos60°)
    petalL.position.set(-joinX, 0, offsetZ);

    petalR.rotation.x = Math.PI / 2;
    petalR.rotation.z = -Math.PI / 3; // 先端方向 (+sin60°, 0, +cos60°)
    petalR.position.set(joinX, 0, offsetZ);

    group.add(petalL, petalR);
  }

  // 🔁 全体を角度分だけ回転（groupごと回す！）
  group.rotation.y = -angleRad;

  return group;
}
