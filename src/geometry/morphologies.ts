import { THREE } from '../three';
import { COLORS } from '../classify';
import type { Morphology } from '../types';
import {
  createElongatedHexPrism,
  createBranchWithChildren,
  createBulletRosette,
  createSidePlanes,
} from './parts';

/**
 * Build the THREE.Group for a single morphology.
 * This is the `switch` body of the original `setCrystalModel(type)` — the
 * scene.remove/add, currentMesh assignment, and DOM updates have been removed.
 * `rng` is a deterministic PRNG replacing the original Math.random().
 */
export function buildMorphology(morphology: Morphology, rng: () => number): THREE.Group {
  switch (morphology) {
    case '砲弾集合': {
      // 凍結雲粒起源の多結晶: シード乱数の放射腕(3〜6本)が {10-1̄1} 錐端を
      // 中心向きに会合する。seed→rng の経路は針(C1a)の長さ乱数と同一
      return createBulletRosette(rng);
    }

    case '角柱': {
      const geo = new THREE.CylinderGeometry(0.4, 0.4, 1.5, 6);
      const baseMat = new THREE.MeshStandardMaterial({ color: COLORS.base, flatShading: true });
      const mesh = new THREE.Mesh(geo, baseMat);

      // 🔷 角の線を追加（青線）
      const edgeMat = new THREE.LineBasicMaterial({ color: COLORS.edge });
      const edges = new THREE.EdgesGeometry(geo);
      const edgeLines = new THREE.LineSegments(edges, edgeMat);

      const group = new THREE.Group();
      group.add(mesh);
      group.add(edgeLines);
      return group;
    }

    case '角板': {
      const group = new THREE.Group();

      // 外側の凹んだ骸晶構造
      const layers = 4;
      const baseRadius = 0.6;
      const baseHeight = 0.3;

      for (let i = 0; i < layers; i++) {
        const ratio = 1 - i * 0.15;
        const r = baseRadius * ratio;
        const height = baseHeight * (1 - i * 0.1);
        const color = new THREE.Color(COLORS.base);

        const sideMat = new THREE.MeshStandardMaterial({
          color: color,
          flatShading: true,
          transparent: true,
          opacity: 0.3,
        });
        const topMat = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
        const geo = new THREE.CylinderGeometry(r, r, height, 6, 1, false);
        const mesh = new THREE.Mesh(geo, [sideMat, topMat, topMat]);
        group.add(mesh);

        const edgeMaterial = new THREE.LineBasicMaterial({ color: COLORS.edge });
        const edges = new THREE.EdgesGeometry(geo);
        const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
        group.add(edgeLines);
      }

      // 中心六角柱（伸びてる感）
      const centerRadius = baseRadius * 1.2;
      const centerHeight = baseHeight * 0.8;
      const centerGeo = new THREE.CylinderGeometry(centerRadius, centerRadius, centerHeight, 6);
      const centerMat = new THREE.MeshStandardMaterial({ color: COLORS.wing });
      const centerMesh = new THREE.Mesh(centerGeo, centerMat);
      centerMesh.position.y = 0; // 真ん中に収める
      group.add(centerMesh);

      const centerEdges = new THREE.EdgesGeometry(centerGeo);
      const centerLines = new THREE.LineSegments(
        centerEdges,
        new THREE.LineBasicMaterial({ color: COLORS.edge }),
      );
      group.add(centerLines);
      return group;
    }

    case '扇形': {
      const group = new THREE.Group();

      // 中心の六角柱
      const centerGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 6);
      const centerMat = new THREE.MeshStandardMaterial({ color: COLORS.base });
      const centerMesh = new THREE.Mesh(centerGeo, centerMat);
      group.add(centerMesh);

      const numPetals = 6;
      // 基部頂点の半径。中心柱の内接半径 0.5·cos30° ≈ 0.433 より内側に置き、隙間ゼロを保証
      const baseRadius = 0.42;

      for (let i = 0; i < numPetals; i++) {
        // +30°位相: CylinderGeometry(6分割)の頂点方位（30° mod 60°）= a軸〈11-20〉に整合
        const angle = (i * Math.PI) / 3 + Math.PI / 6;

        // 伸長六角形プリズムの花弁（全内角120°・対辺平行）。先端は半径 0.42 + 1.1 = 1.52
        const petal = createElongatedHexPrism(0.5, 1.1, 0.1);

        // XZ平面に寝かせ（厚み中心 y=0）、長軸の先端を放射方向外向きへ
        petal.rotation.x = Math.PI / 2;
        petal.rotation.z = angle - Math.PI / 2; // 長軸 +Y → (cosθ, 0, sinθ)
        petal.position.set(baseRadius * Math.cos(angle), 0, baseRadius * Math.sin(angle));

        group.add(petal);
      }
      return group;
    }

    case '樹枝状': {
      const group = new THREE.Group();

      // 中心の六角柱
      const centerGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 6);
      const centerMat = new THREE.MeshStandardMaterial({ color: COLORS.base });
      const centerMesh = new THREE.Mesh(centerGeo, centerMat);
      group.add(centerMesh);

      // 6方向に主枝 + 副枝を放射状に配置
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3; // 60度間隔
        const branch = createBranchWithChildren(angle);
        branch.position.set(0, 0, 0);
        group.add(branch);
      }
      return group;
    }

    case '針': {
      const group = new THREE.Group();
      const outerRadius = 0.4;
      const baseHeight = 2.0;
      const layers = 6;

      let topRadius = 0;
      const edgeThickness = 0.15;
      const edgeLength = 0.55;
      let edgeHeight = 0;

      for (let i = 0; i < layers; i++) {
        const ratio = 1 - i * 0.12;
        const r = outerRadius * ratio;
        const height = baseHeight * (0.8 - i * 0.08);
        const color = new THREE.Color(COLORS.base);

        const mat = new THREE.MeshStandardMaterial({
          color: color,
          flatShading: true,
          transparent: true,
          opacity: i === 0 ? 1.0 : 0.3,
        });

        const geo = new THREE.CylinderGeometry(r, r, height, 6, 1, i !== layers - 1);
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);

        const edges = new THREE.EdgesGeometry(geo);
        const edgeLines = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: COLORS.edge }),
        );
        group.add(edgeLines);

        if (i === 0) {
          topRadius = r;
          edgeHeight = height + 0.001;

          const edgeGroup = new THREE.Group();
          for (let j = 0; j < 6; j++) {
            const angle = (Math.PI / 3) * j;
            const x = topRadius * Math.cos(angle);
            const z = topRadius * Math.sin(angle);

            const boxGeo = new THREE.BoxGeometry(edgeLength, edgeHeight, edgeThickness);
            const boxMat = new THREE.MeshStandardMaterial({ color: COLORS.base });
            const edgeBox = new THREE.Mesh(boxGeo, boxMat);

            edgeBox.position.set(x, 0, z);
            edgeBox.rotation.y = -angle + Math.PI / 2;
            edgeGroup.add(edgeBox);
          }
          group.add(edgeGroup);
        }
      }

      // 🧩 針の配置（六角柱の角に完全接続）
      const needleMaterial = new THREE.MeshStandardMaterial({ color: COLORS.wing });
      const needleRadius = edgeThickness / Math.sqrt(3); // ✅ 六角柱角と合うサイズ

      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 + Math.PI / 6; // ← 六角柱の角方向に修正
        const baseX = topRadius + edgeThickness; // ←厚みを考慮
        const x = baseX * Math.cos(angle) - needleRadius * Math.cos(angle);
        const z = baseX * Math.sin(angle) - needleRadius * Math.sin(angle);

        const lengthTop = 1.5 + rng() * 0.5;
        const lengthBottom = 1.5 + rng() * 0.5;

        const topY = baseHeight / 4.5 + edgeHeight / 4.5;
        const bottomY = -baseHeight / 4.5 - edgeHeight / 4.5;

        // 上向き針
        const geo1 = new THREE.CylinderGeometry(needleRadius, needleRadius, lengthTop, 6);
        const mesh1 = new THREE.Mesh(geo1, needleMaterial);
        mesh1.position.set(x, topY + lengthTop / 2, z);
        mesh1.rotation.y = 0;
        group.add(mesh1);

        // 下向き針
        const geo2 = new THREE.CylinderGeometry(needleRadius, needleRadius, lengthBottom, 6);
        const mesh2 = new THREE.Mesh(geo2, needleMaterial);
        mesh2.position.set(x, bottomY - lengthBottom / 2, z);
        mesh2.rotation.y = 0;
        group.add(mesh2);
      }
      return group;
    }

    case '側面': {
      // 凍結雲粒起源の多結晶: 共通スパイン(a軸)から CSL 70.3° アンカーの二面角で
      // 張り出す半六角薄板 4〜7 枚。seed→rng の経路は針・ロゼットと同一
      return createSidePlanes(rng);
    }

    case '厚角板': {
      const geo = new THREE.CylinderGeometry(0.6, 0.6, 0.4, 6);
      const mat = new THREE.MeshStandardMaterial({
        color: COLORS.base,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geo, mat);

      // 🔷 エッジを追加（角線）
      const edgeGeo = new THREE.EdgesGeometry(geo);
      const edgeMat = new THREE.LineBasicMaterial({ color: COLORS.edge });
      const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);

      const group = new THREE.Group();
      group.add(mesh);
      group.add(edgeLines);
      return group;
    }

    case '骸晶角板': {
      const group = new THREE.Group();
      const layers = 4;
      const baseRadius = 0.6;
      const baseHeight = 0.3;

      for (let i = 0; i < layers; i++) {
        const ratio = 1 - i * 0.15;
        const r = baseRadius * ratio;
        const height = baseHeight * (1 - i * 0.1);

        // 中心だけ COLORS.wing、それ以外は側面非表示
        const color = i === layers - 1 ? COLORS.wing : COLORS.base;

        const sideMat = new THREE.MeshStandardMaterial({
          color: color,
          flatShading: true,
          transparent: i !== layers - 1,
          opacity: i !== layers - 1 ? 0 : 1, // 外側層は透明、中心だけ不透明
        });
        const topMat = new THREE.MeshStandardMaterial({
          color: color,
          flatShading: true,
          transparent: false,
        });

        const geo = new THREE.CylinderGeometry(r, r, height, 6, 1, false);
        const mesh = new THREE.Mesh(geo, [sideMat, topMat, topMat]);
        group.add(mesh);

        const edgeMaterial = new THREE.LineBasicMaterial({ color: COLORS.edge });
        const edges = new THREE.EdgesGeometry(geo);
        const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
        group.add(edgeLines);
      }
      return group;
    }

    case '骸晶角柱': {
      const group = new THREE.Group();
      const baseRadius = 0.4; // 六角柱の半径
      const baseHeight = 1.5; // 六角柱の高さ

      // ✅ メインの六角柱（外側）
      const outerGeo = new THREE.CylinderGeometry(baseRadius, baseRadius, baseHeight, 6);
      const outerMat = new THREE.MeshStandardMaterial({ color: COLORS.base, flatShading: true });
      const outerMesh = new THREE.Mesh(outerGeo, outerMat);
      group.add(outerMesh);

      // ✅ 外側の角線（エッジライン）
      const outerEdges = new THREE.EdgesGeometry(outerGeo);
      group.add(new THREE.LineSegments(outerEdges, new THREE.LineBasicMaterial({ color: COLORS.edge })));

      // ✅ 各面に沿った四角柱の骨格構造（6方向に配置）
      const edgeGroup = new THREE.Group();
      const edgeLength = 0.55;
      const edgeThickness = 0.15;
      const edgeHeight = baseHeight + 0.2; // ここが深さ調整

      for (let j = 0; j < 6; j++) {
        const angle = (Math.PI / 3) * j;
        const x = baseRadius * Math.cos(angle);
        const z = baseRadius * Math.sin(angle);
        const boxGeo = new THREE.BoxGeometry(edgeLength, edgeHeight, edgeThickness);
        const boxMat = new THREE.MeshStandardMaterial({ color: COLORS.base });
        const edgeBox = new THREE.Mesh(boxGeo, boxMat);
        edgeBox.position.set(x, 0, z);
        edgeBox.rotation.y = -angle + Math.PI / 2; // 各面に接するように回転
        edgeGroup.add(edgeBox);
      }
      group.add(edgeGroup);

      // ✅ 中央の六角形の「凹み」部分を深く沈めるメッシュを追加（上下面に）
      const dentRadius = baseRadius * 0.7; // 中心の凹みの半径（少し小さめ）
      const dentHeight = 0.2; // 非常に薄い高さ（凹みの厚み）
      const dentDepth = 0.15; // 凹ませる深さ（通常より深くする）

      const dentMat = new THREE.MeshStandardMaterial({
        color: COLORS.highlight, // ハイライトカラーで視認性アップ
        flatShading: true,
      });

      // 上面の凹み
      const topDent = new THREE.Mesh(
        new THREE.CylinderGeometry(dentRadius, dentRadius, dentHeight, 6),
        dentMat,
      );
      topDent.position.y = baseHeight / 2 - dentHeight / 2 - dentDepth;
      group.add(topDent);

      // 下面の凹み（反転）
      const bottomDent = topDent.clone();
      bottomDent.position.y = -baseHeight / 2 + dentHeight / 2 + dentDepth;
      group.add(bottomDent);

      // ✅ 側面の凹み（Boxを貼り付け、Edgesで視認可能にする）
      const sideDentGroup = new THREE.Group();
      const dentW = 0.55; // 横幅（六角柱1辺の長さ）
      const dentH = 0.4; // 高さ（縦）
      const dentD = 0.05; // 厚み（奥行き）
      const dentInset = 0.02; // 凹ませる距離（少し内側へ）

      for (let j = 0; j < 6; j++) {
        const angle = (Math.PI / 3) * j;

        // 内側に沈めた位置
        const x = (baseRadius - dentD / 2 - dentInset) * Math.cos(angle);
        const z = (baseRadius - dentD / 2 - dentInset) * Math.sin(angle);

        // ジオメトリとメッシュ
        const dentGeo = new THREE.BoxGeometry(dentD, dentH, dentW);
        const dentMesh = new THREE.Mesh(dentGeo, dentMat);
        dentMesh.position.set(x, 0, z);
        dentMesh.rotation.y = -angle;

        // ✅ エッジライン追加（明るい色で輪郭を見せる）
        const edgeGeo = new THREE.EdgesGeometry(dentGeo);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x88ccff }); // 明るめの水色
        const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
        edgeLines.rotation.y = -angle;
        edgeLines.position.set(x, 0, z);

        sideDentGroup.add(dentMesh);
        sideDentGroup.add(edgeLines);
      }

      group.add(sideDentGroup);
      return group;
    }

    case 'さや': {
      const group = new THREE.Group();
      const layers = 6;
      const baseRadius = 0.4;
      const baseHeight = 2.0;

      for (let i = 0; i < layers; i++) {
        const ratio = 1 - i * 0.12;
        const r = baseRadius * ratio;
        const height = baseHeight * (0.8 - i * 0.08);
        const color = new THREE.Color(COLORS.edge);

        const mat = new THREE.MeshStandardMaterial({
          color: color,
          flatShading: true,
          transparent: true,
          opacity: i === 0 ? 1.0 : 0.3,
        });

        const geo = new THREE.CylinderGeometry(r, r, height, 6, 1, i !== layers - 1);
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);

        const edges = new THREE.EdgesGeometry(geo);
        const edgeLines = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: COLORS.edge }),
        );
        group.add(edgeLines);

        // ✅ 最外層の六角柱に沿って立体的な辺（エッジ）を追加
        if (i === 0) {
          const edgeGroup = new THREE.Group();
          const edgeRadius = r;
          const edgeLength = 0.55; // 六角柱の一辺の長さ
          const edgeThickness = 0.15;
          const edgeHeight = height + 0.001;

          for (let j = 0; j < 6; j++) {
            const angle = (Math.PI / 3) * j;
            const x = edgeRadius * Math.cos(angle);
            const z = edgeRadius * Math.sin(angle);

            const boxGeo = new THREE.BoxGeometry(edgeLength, edgeHeight, edgeThickness);
            const boxMat = new THREE.MeshStandardMaterial({ color: COLORS.base });
            const edgeBox = new THREE.Mesh(boxGeo, boxMat);

            edgeBox.position.set(x, 0, z);
            edgeBox.rotation.y = -angle + Math.PI / 2;

            edgeGroup.add(edgeBox);
          }

          group.add(edgeGroup);
        }
      }
      return group;
    }

    default: {
      // 元実装の switch default（到達しないが安全側のフォールバック）
      const group = new THREE.Group();
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshStandardMaterial({
        color: 0x66aaff,
        flatShading: true,
        side: THREE.DoubleSide,
      });
      group.add(new THREE.Mesh(geometry, material));
      return group;
    }
  }
}
