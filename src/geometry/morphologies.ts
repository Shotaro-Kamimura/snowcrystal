import { THREE } from '../three';
import { COLORS } from '../classify';
import type { Morphology } from '../types';
import {
  createElongatedHexPrism,
  createBranchWithChildren,
  createBulletRosette,
  createSidePlanes,
  extrudePrism,
  outlineToShape,
  type DendriteArmOptions,
  type SidePlanesOptions,
} from './parts';
import { dentedHexOutline } from './hexOutlineBuilder';

/**
 * 星状(P1d)の腕パラメタ(案 M 設計書 §3.1・裁量 2)。
 * 細い 6 本主枝・副枝なし — 最小差分(主枝・中心は樹枝状と共通)。
 * テストから参照する内部 export(src/index.ts には追加しない)。
 */
export const STELLAR_ARM_PARAMS: DendriteArmOptions = { sideCount: 0 };

/**
 * 羊歯(P1f)の腕パラメタ(案 M 設計書 §3.1・裁量 3)。副枝を密(5 対・間隔 0.3、
 * offsetZ = 0.3〜1.5)・長め(0.75)・細め(0.22)にしたシダの羽状感。
 * 最内副枝(offsetZ 0.3)の基部は中心六角柱内に埋まるが「接合部は埋め込み」の
 * 既存流儀による意図的なもの(先端は中心外)。
 */
export const FERNLIKE_ARM_PARAMS: DendriteArmOptions = {
  sideCount: 5,
  sideSpacing: 0.3,
  sideStart: 1.0,
  sideLength: 0.75,
  sideWidth: 0.22,
};

/**
 * 長柱(N1e)の寸法(案 M 設計書 §3.2・裁量 4 = 案 1)。H/D = 4.0 —
 * 全高を針・さや族(2.0)と揃え、角柱(H/D 1.875)との差を一目で立たせる。
 * 目視ラウンドで案 2(R 0.3 / H 2.7)・案 3(R 0.2 / H 2.2)へ差し替え可能なよう
 * 名前付き定数とする。確定は CP-M2 目視判定。
 */
export const LONG_COLUMN_DIMS = { radius: 0.25, height: 2.0 } as const;

/**
 * 扇形族(扇形・広幅枝)の花弁パラメタ(案 K 設計書 §3.2)。省略時は
 * SECTOR_PETAL_DEFAULTS(現行扇形の採用値 — 出力ビット不変の基準。
 * DENDRITE_ARM_DEFAULTS と同じくリテラル固定テストで退行を検知する)。
 */
export interface SectorPetalOptions {
  /** 花弁幅(elongatedHexOutline の width) */
  petalWidth?: number;
  /** 花弁長(基部頂点 → 先端頂点) */
  petalLength?: number;
  /** 花弁厚 */
  petalThickness?: number;
  /** 基部頂点の半径(中心柱への埋め込み量を決める) */
  baseRadius?: number;
}

/**
 * 現行の扇形(P1b)の花弁パラメタ(v1 由来の採用値そのまま)。
 * 扇形の出力ビット不変の基準値(案 K 設計書 §3.2 — DENDRITE_ARM_DEFAULTS 方式)。
 * 案 K 内部 API — src/index.ts には export しない。
 */
export const SECTOR_PETAL_DEFAULTS = {
  petalWidth: 0.5,
  petalLength: 1.1,
  petalThickness: 0.1,
  baseRadius: 0.42,
} as const;

/**
 * 広幅枝(P1c)案 1 = 平行広幅(案 K 設計書 §3.2)。扇形のパラメタ族:
 * 花弁幅のみ 0.5 → 0.75(長さ・基部半径は据え置き)。花弁間の隙間が狭まり
 * 「広幅の枝」が立つ。伸長六角形のまま {10-1̄0} 整合は構成的に維持。
 * 基部付近(r < 0.75)で隣接花弁が同一平面で重なるが、同材質・同法線
 * (COLORS.wing・上面 +Y)のため視覚上は連続面になる(目視確定は CP-K2 停止 2)。
 */
export const BROAD_BRANCH_PARALLEL_PARAMS: SectorPetalOptions = {
  petalWidth: 0.75,
};

/** 広幅枝 案 2 の正六角形花弁の外接半径 R_p(採用値の根拠は下記定数コメント)。 */
const BROAD_BRANCH_HEX_R = 0.46;

/**
 * 広幅枝(P1c)案 2 = 拡幅(頂点接続六角形花弁)(案 K 設計書 §3.2)。
 * 正六角形板(外接半径 R_p)を頂点で中心ハブに接続: elongatedHexOutline は
 * width = √3·R_p・length = 2·R_p のとき全辺長 R_p の正六角形になる(全内角 120°・
 * 中心側頂点から中央で最大幅 √3·R_p まで拡幅 → 120° 先端へ先細り、が構成的に成立)。
 * 花弁軸 = a 軸(30° + k·60°)で頂点方位 = 軸 + k·60° — Cylinder 族(R2)と格子整合。
 * baseRadius 0.48: 中心柱の角頂点(0.5)の 0.02 内側へ埋め込み(隙間ゼロ保証 —
 * 扇形の 0.42 と同じ流儀)。側方頂点の方位角 atan(√3R_p/2 / (0.48 + R_p/2)) ≈ 29.3°
 * < 30° のため隣接花弁とは重ならない(R_p > baseRadius だと 30° を超え交差する)。
 */
export const BROAD_BRANCH_HEX_PETAL_PARAMS: SectorPetalOptions = {
  petalWidth: Math.sqrt(3) * BROAD_BRANCH_HEX_R,
  petalLength: 2 * BROAD_BRANCH_HEX_R,
  baseRadius: 0.48,
};

/**
 * 鱗状側面(ML66 S2、仮実装)— 側面のパラメタ族(案 K 設計書 §4.2):
 * フィン小型化(radiusBase 0.9 → 0.5)・枚数増(count 6〜7 = 現行レンジ [4,7] の
 * 上側に固定)・スパイン方向スタッガ拡大(±0.4 → ±0.9。小さな鱗が軸方向に
 * ずれて重なる ML66 Fig.1 の読み)。フィン形状(半六角・スパイン = a 軸)と
 * CSL 双晶角 70.3° アンカーは不変(S2 も同族の多結晶側面 — 結晶学アンカーは
 * 仮にしない)。最終値は CP-K5 停止 2 の目視で確定(砲弾・側面 S1 と同方式の一任)。
 * 案 K 内部 API — src/index.ts には export しない。
 */
export const SCALELIKE_SIDE_PLANE_PARAMS: SidePlanesOptions = {
  radiusBase: 0.5,
  countRange: [6, 7],
  staggerSpan: 0.9,
};

/**
 * 扇形族の共通ビルド: 中心六角柱(0.5/0.2)+ 花弁 6 枚(30° + k·60° = a 軸整合)。
 * 構成・生成順・演算順は旧 '扇形' case と同一(デフォルトマージのみ —
 * 扇形はビット同一、案 K 設計書 §3.2。樹枝状の createBranchWithChildren と同方式)。
 */
function buildSectorFamily(opts: SectorPetalOptions = {}): THREE.Group {
  const p = { ...SECTOR_PETAL_DEFAULTS, ...opts };
  const group = new THREE.Group();

  // 中心の六角柱
  const centerGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 6);
  const centerMat = new THREE.MeshStandardMaterial({ color: COLORS.base });
  const centerMesh = new THREE.Mesh(centerGeo, centerMat);
  group.add(centerMesh);

  const numPetals = 6;
  // 基部頂点の半径。既定 0.42 は中心柱の内接半径 0.5·cos30° ≈ 0.433 より内側で隙間ゼロを保証
  const baseRadius = p.baseRadius;

  for (let i = 0; i < numPetals; i++) {
    // +30°位相: CylinderGeometry(6分割)の頂点方位（30° mod 60°）= a軸〈11-20〉に整合
    const angle = (i * Math.PI) / 3 + Math.PI / 6;

    // 伸長六角形プリズムの花弁（全内角120°・対辺平行）。先端は半径 baseRadius + petalLength
    const petal = createElongatedHexPrism(p.petalWidth, p.petalLength, p.petalThickness);

    // XZ平面に寝かせ（厚み中心 y=0）、長軸の先端を放射方向外向きへ
    petal.rotation.x = Math.PI / 2;
    petal.rotation.z = angle - Math.PI / 2; // 長軸 +Y → (cosθ, 0, sinθ)
    petal.position.set(baseRadius * Math.cos(angle), 0, baseRadius * Math.sin(angle));

    group.add(petal);
  }
  return group;
}

/**
 * 広幅枝 案 1(平行広幅)の内部ビルダー。buildMorphology('広幅枝') の既定。
 * 案 K 内部 API — src/index.ts には export しない(K2 申し送り:
 * variant 切替は公開 API に出さず、playground から深 import で利用する)。
 */
export function buildBroadBranchPlan1(): THREE.Group {
  return buildSectorFamily(BROAD_BRANCH_PARALLEL_PARAMS);
}

/**
 * 広幅枝 案 2(拡幅・頂点接続六角形花弁)の内部ビルダー。9 月専門家確認 (1) の
 * 比較表示用に playground の比較トグルから深 import で呼ぶ(案 K 設計書 §3.2)。
 * 公開 API には出さない(同上)。
 */
export function buildBroadBranchPlan2(): THREE.Group {
  return buildSectorFamily(BROAD_BRANCH_HEX_PETAL_PARAMS);
}

/**
 * 樹枝状族(星状・羊歯)の共通ビルド: 中心六角柱(0.5/0.2)+ 腕 6 本(60° 間隔)。
 * '樹枝状' case は出力ビット不変の基準(設計書 §3.1)のため本ヘルパーへ寄せず無変更。
 */
function buildDendriteFamily(opts: DendriteArmOptions): THREE.Group {
  const group = new THREE.Group();

  const centerGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 6);
  const centerMat = new THREE.MeshStandardMaterial({ color: COLORS.base });
  group.add(new THREE.Mesh(centerGeo, centerMat));

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3; // 60度間隔(樹枝状と同じ a 軸整合)
    group.add(createBranchWithChildren(angle, opts));
  }
  return group;
}

/**
 * 花形断面(dentedHexOutline)の採用寸法(設計書 §2.1 目安 → CP-B3 で実測比較し確定)。
 * - skeletal(骸晶角柱): 目安どおり m 0.16 / w 0.08。溝深さ g = (√3/2)·w ≈ 0.069 は
 *   apothem(≈ 0.346)の 20%。v1 の側面凹み Box は外面が apothem より突出した擬似表現
 *   (幾何学的な深さの踏襲元なし)のため、外形包絡 R のみ厳密維持し深さは目安値を採用。
 * - sheath(さや・針の中心柱): 薄肉。溝の辺方向占有幅 m + w = 0.15 が v1 エッジ Box の
 *   厚み 0.15 と一致し、置換前後で側面の視覚周期を保つ。g ≈ 0.043(apothem の 12.5%)。
 * テストから参照する内部 export(src/index.ts には追加しない)。
 */
export const DENT_DIMS = {
  skeletal: { m: 0.16, w: 0.08 },
  sheath: { m: 0.1, w: 0.05 },
} as const;

/**
 * 花形断面を c 軸(+Y)方向へ高さ height で押し出した柱ジオメトリ(厚み中心 y = 0)。
 * extrudePrism は +Z 押し出しのため rotateX(90°) で立てる(断面方位は保存:
 * アウトラインの atan2(y, x) がそのまま柱の atan2(z, x) になる)。
 */
function dentedHexColumn(R: number, m: number, w: number, height: number): THREE.ExtrudeGeometry {
  const geo = extrudePrism(dentedHexOutline(R, m, w), height);
  geo.rotateX(Math.PI / 2);
  return geo;
}

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

    case '長柱': {
      // 長柱(ML66 N1e、Shimizu)— 角柱の寸法族(案 M 設計書 §3.2)。
      // 構成は角柱と同一: CylinderGeometry(…, 6) + EdgesGeometry
      const geo = new THREE.CylinderGeometry(
        LONG_COLUMN_DIMS.radius,
        LONG_COLUMN_DIMS.radius,
        LONG_COLUMN_DIMS.height,
        6,
      );
      const baseMat = new THREE.MeshStandardMaterial({ color: COLORS.base, flatShading: true });
      const mesh = new THREE.Mesh(geo, baseMat);

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
      // 扇形(ML66 P1b)— 扇形族の基準値(SECTOR_PETAL_DEFAULTS。先端 0.42 + 1.1 = 1.52)。
      // 出力は族化前とビット同一(案 K 設計書 §3.2、フルメッシュ署名で機械確認)
      return buildSectorFamily();
    }

    case '広幅枝': {
      // 広幅枝(ML66 P1c、crystal with broad branches)— 仮実装(provisional)。
      // 既定 = 案 1(平行広幅: v1 以来の現行解釈との連続性)。案 2(拡幅六角花弁)は
      // buildBroadBranchPlan2 を playground の比較トグルから深 import(K2 申し送り —
      // variant 切替は公開 API に出さない)。9 月専門家確認 (1) で確定
      return buildBroadBranchPlan1();
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

    case '星状': {
      // 星状(ML66 P1d、stellar crystal)— 樹枝状のパラメタ族: 副枝なし(§3.1)
      return buildDendriteFamily(STELLAR_ARM_PARAMS);
    }

    case '羊歯': {
      // 羊歯(ML66 P1f、fernlike crystal)— 樹枝状のパラメタ族: 副枝を密・長めに(§3.1)
      return buildDendriteFamily(FERNLIKE_ARM_PARAMS);
    }

    case '針': {
      const group = new THREE.Group();
      const outerRadius = 0.4;
      const baseHeight = 2.0;
      const layers = 6;

      let topRadius = 0;
      // 旧エッジ Box の厚み。Box は花形断面へ置換済みだが、針の半径(/√3)と
      // 配置半径(topRadius + 0.15)の基準値として数値を維持する(§2.4 見た目踏襲)
      const edgeThickness = 0.15;
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

        // 中心柱(i = 0): 花形断面(薄肉、さやと同パラメタ)の押し出し —
        // 旧 六角柱 + エッジ Box 6 本を置換(設計書 §2.4)。i ≥ 1 の透明レイヤーは踏襲
        const geo: THREE.BufferGeometry =
          i === 0
            ? dentedHexColumn(r, DENT_DIMS.sheath.m, DENT_DIMS.sheath.w, height)
            : new THREE.CylinderGeometry(r, r, height, 6, 1, i !== layers - 1);
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
          edgeHeight = height + 0.001; // 旧エッジ Box の高さ(+0.001)。針の Y 配置基準として維持
        }
      }

      // 🧩 針の配置（六角柱の角に完全接続）
      const needleMaterial = new THREE.MeshStandardMaterial({ color: COLORS.wing });
      // 旧エッジ Box(厚み 0.15)の角に内接する六角柱半径として 0.15/√3 ≈ 0.0866 と
      // 導出された値。Box 置換後も見た目踏襲のため数値を維持(花形断面の w とは独立、§2.4)
      const needleRadius = edgeThickness / Math.sqrt(3);

      // Θ0 = 30°(π/6): CylinderGeometry(…,6) のローカル頂点方位の較正定数。
      // 頂点座標からの機械確定: 上面リング 6 頂点の atan2(z, x) = ±30°, ±90°, ±150°
      // ≡ 30° (mod 60°)。rotation.y = ρ は方位を −ρ シフトするため、
      // rotation.y = −φ_i + Θ0 で頂点 1 本が radial 方向 φ_i に一致する(設計書 §2.4)。
      // φ_i = 30° + i·60° では −φ_i + Θ0 = −i·60° ≡ 0 (mod 60°) となり、
      // 6 回対称により針本体は v1(rotation.y = 0)と同一形状
      const THETA0 = Math.PI / 6;

      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 + Math.PI / 6; // φ_i = 六角柱の角方向
        const baseX = topRadius + edgeThickness; // ←厚みを考慮
        const x = baseX * Math.cos(angle) - needleRadius * Math.cos(angle);
        const z = baseX * Math.sin(angle) - needleRadius * Math.sin(angle);

        const lengthTop = 1.5 + rng() * 0.5;
        const lengthBottom = 1.5 + rng() * 0.5;

        const topY = baseHeight / 4.5 + edgeHeight / 4.5;
        const bottomY = -baseHeight / 4.5 - edgeHeight / 4.5;

        // 上向き針(rotation.y はファセット方位の明示整合 — Θ0 コメント参照)
        const geo1 = new THREE.CylinderGeometry(needleRadius, needleRadius, lengthTop, 6);
        const mesh1 = new THREE.Mesh(geo1, needleMaterial);
        mesh1.position.set(x, topY + lengthTop / 2, z);
        mesh1.rotation.y = -angle + THETA0;
        group.add(mesh1);

        // 下向き針
        const geo2 = new THREE.CylinderGeometry(needleRadius, needleRadius, lengthBottom, 6);
        const mesh2 = new THREE.Mesh(geo2, needleMaterial);
        mesh2.position.set(x, bottomY - lengthBottom / 2, z);
        mesh2.rotation.y = -angle + THETA0;
        group.add(mesh2);
      }
      return group;
    }

    case '側面': {
      // 凍結雲粒起源の多結晶: 共通スパイン(a軸)から CSL 70.3° アンカーの二面角で
      // 張り出す半六角薄板 4〜7 枚。seed→rng の経路は針・ロゼットと同一
      return createSidePlanes(rng);
    }

    case '鱗状側面': {
      // 鱗状側面(ML66 S2、scalelike side planes)— 仮実装(provisional)。
      // 側面のパラメタ族(SCALELIKE_SIDE_PLANE_PARAMS: 小型・密・スタッガ拡大)。
      // 縦位置(図上範囲)は ML66 原典忠実のまま — 9 月専門家確認 (5) で確定
      // (案 K 設計書 §4)
      return createSidePlanes(rng, SCALELIKE_SIDE_PLANE_PARAMS);
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
      const baseHeight = 1.5; // 六角柱の高さ(全高は 2 段組でも不変)
      // 端面の窪み深さ = リップ高さ(v1 の dentDepth 0.15 を踏襲)。
      // v1 の「端面の凹み」は Box 骨格の +0.2 はみ出しが作る縁の錯視で、沈め六角柱は
      // 閉キャップ内部に埋没し不可視だった — 実ジオメトリの窪み端面へ置換する
      // (骸晶角柱の定義的特徴 = 中空端面。2026-06-11 チャット判定・修正ラウンド 2)
      const lip = 0.15;

      const edgeLineMat = new THREE.LineBasicMaterial({ color: COLORS.edge });
      const sideMat = new THREE.MeshStandardMaterial({ color: COLORS.base, flatShading: true });

      // コア: 花形断面(辺中央凹み)の押し出し(高さ H − 2·lip、中央配置)。
      // 旧 Box 骨格 6 本 + 側面凹み Box 6 枚(+ 水色エッジ線)の置換(設計書 §2.2)。
      // キャップ(index 0)= 窪みの床。ハイライト色で v1 の沈め六角柱の意匠を踏襲
      const coreGeo = dentedHexColumn(
        baseRadius,
        DENT_DIMS.skeletal.m,
        DENT_DIMS.skeletal.w,
        baseHeight - 2 * lip,
      );
      const floorMat = new THREE.MeshStandardMaterial({
        color: COLORS.highlight,
        flatShading: true,
      });
      group.add(new THREE.Mesh(coreGeo, [floorMat, sideMat]));
      group.add(new THREE.LineSegments(new THREE.EdgesGeometry(coreGeo), edgeLineMat));

      // リップリング ×2: 外形 = 同花形断面(凹み溝は全高で連続)/ 穴 = 六角形。
      // 穴は円半径 0.28(= v1 dentRadius 0.4×0.7)・頂点を角方向(0° + k·60°)に配置。
      // 穴の apothem 0.28·cos30° ≈ 0.243 < 凹み床の中心距離 apothem − g ≈ 0.277 で
      // 凹み溝と干渉せず、角方向の壁厚は 0.4 − 0.28 = 0.12
      const holeRadius = 0.28;
      const ringShape = outlineToShape(
        dentedHexOutline(baseRadius, DENT_DIMS.skeletal.m, DENT_DIMS.skeletal.w),
      );
      const hole = new THREE.Path();
      for (let k = 0; k < 6; k++) {
        const a = -(Math.PI / 3) * k; // CW(THREE.Shape の穴の向き規約)
        const hx = holeRadius * Math.cos(a);
        const hy = holeRadius * Math.sin(a);
        if (k === 0) hole.moveTo(hx, hy);
        else hole.lineTo(hx, hy);
      }
      hole.closePath();
      ringShape.holes.push(hole);

      const ringGeo = new THREE.ExtrudeGeometry(ringShape, { depth: lip, bevelEnabled: false });
      ringGeo.translate(0, 0, -lip / 2); // 厚み中心合わせ(extrudePrism と同イディオム)
      ringGeo.rotateX(Math.PI / 2); // c 軸 +Y へ(dentedHexColumn と同じ向き規約)

      for (const sign of [1, -1]) {
        const ring = new THREE.Mesh(ringGeo, sideMat);
        ring.position.y = (sign * (baseHeight - lip)) / 2; // 上下端: y ∈ ±[H/2 − lip, H/2]
        group.add(ring);
        const ringLines = new THREE.LineSegments(new THREE.EdgesGeometry(ringGeo), edgeLineMat);
        ringLines.position.y = ring.position.y;
        group.add(ringLines);
      }

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

        // 最外層: 花形断面(薄肉)の押し出し — 旧 六角柱 + エッジ Box 6 本を置換
        // (設計書 §2.3。縦溝の意匠は 240° 凹角の彫り込みで表現)。内側 5 重は踏襲
        const geo: THREE.BufferGeometry =
          i === 0
            ? dentedHexColumn(r, DENT_DIMS.sheath.m, DENT_DIMS.sheath.w, height)
            : new THREE.CylinderGeometry(r, r, height, 6, 1, i !== layers - 1);
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);

        const edges = new THREE.EdgesGeometry(geo);
        const edgeLines = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: COLORS.edge }),
        );
        group.add(edgeLines);
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
