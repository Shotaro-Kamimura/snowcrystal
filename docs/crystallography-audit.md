# 結晶学的整合性監査 (crystallography audit)

対象: `src/geometry/parts.ts` / `src/geometry/morphologies.ts` / `src/classify.ts` / `src/createSnowCrystal.ts`
日付: 2026-06-10
※ 本書は v1（コミット `f3e5371` 時点）のスナップショット。文中の行番号も同時点のもの。指摘 1.1-1（樹枝状の副枝角）はコミット `5769f9b` で修正済み（経過は [v1-to-v2.md](./v1-to-v2.md) を参照）。
前提: 氷Ih の底面内では a 軸が3本 120° 間隔。{10-10} 柱面で囲まれた輪郭は、エッジ方位が 60° 系列に載り、隣接エッジのなす内角が 120°(凹部は 240°)になる。

## 1. 9形態の監査表

「先端角の実効値」はプリミティブの頂点座標からの算出値。
凧形プリミティブの先端角 = `2·atan((width/2) / height)`。

| 形態 (コード) | 使用プリミティブ | 角度定数 | 側面が平行か | 先端角の実効値 | 結晶学的評価 |
|---|---|---|---|---|---|
| 角柱 (C3a) | `CylinderGeometry(0.4, 0.4, 1.5, 6)` + EdgesGeometry | 6分割 (60° 間隔、CylinderGeometry 内部) | ✅ 対面平行(正六角形断面) | 先端なし。頂点内角 120° | ✅ 整合 |
| 角板 (P1a) | `CylinderGeometry(r, r, h, 6)` ×4層 + 中心六角柱 | 同上 | ✅ 対面平行 | 先端なし。頂点内角 120° | ✅ 整合 |
| 厚角板 (P1b) | `CylinderGeometry(0.6, 0.6, 0.4, 6)` | 同上 | ✅ 対面平行 | 先端なし。頂点内角 120° | ✅ 整合 |
| 骸晶角板 (P1c) | `CylinderGeometry` ×4層(外層は側面透明) | 同上 | ✅ 対面平行 | 先端なし。頂点内角 120° | ✅ 整合 |
| 骸晶角柱 (C3b) | 六角柱 + `BoxGeometry(0.55, h, 0.15)` 骨格×6 + 凹み六角柱 + 凹みBox×6 | 配置 `(π/3)·j`、回転 `-angle + π/2` | △ 六角柱部は平行。Box 骨格は長方形断面で、辺長 0.55 > 六角柱一辺 0.4 のため角部で相互貫入 | 先端なし | △ 配置角は 60° 系列で正しいが、骨格 Box は {10-10} 面由来でない近似 |
| 針 (C1a) | 六角柱×6層 + `BoxGeometry` エッジ×6 + 針 `CylinderGeometry(r, r, len, 6)` ×12 | 柱面配置 `(π/3)·j`、針配置 `(i·π/3) + π/6`(角方向)、針 `rotation.y = 0` 固定 | △ 柱・針とも六角形断面で対面平行。ただし針の `rotation.y = 0` 固定により、針自身のファセット方位が配置角と無関係(6本とも同一方位) | 先端なし(針は平頭) | △ 配置は整合。針のファセット方位だけ非整合 |
| さや (C2a) | 六角柱×6層(側面透明) + `BoxGeometry(0.55, h, 0.15)` エッジ×6 | 配置 `(π/3)·j`、回転 `-angle + π/2` | △ 六角柱部は平行。Box は骸晶角柱と同じ近似 | 先端なし | △ 同上 |
| **扇形 (P4f)** | 中心六角柱 + **`createDiamondPrism()`** ×6 | 花弁配置 `(i·π/3)`、`petal.rotation.z = π/2`、**`tilt = -Math.PI/2`(コメントは「-45度で倒す」)** | ❌ 凧形(topHeight 1.5 ≠ bottomHeight 0.4)のため対辺非平行 | **上側先端 ≈ 29.9°**(`2·atan(0.4/1.5)`、中心向き)/ **下側先端 = 90.0°**(`2·atan(0.4/0.4)`、外周向き) | ❌ width 0.8 / topHeight 1.5 / bottomHeight 0.4 は任意比率。エッジ方位(軸から ±14.9° / ±45°)が 60° 系列に載らず、{10-10} 由来でない。外周先端は本来 120° |
| **樹枝状 (P4g)** | 中心六角柱 + **`createBranchWithChildren()`** ×6(主枝 `BoxGeometry(0.08, 0.08, 2.0)` + 副枝 **`createMiniDiamondPrism()`** ×6/枝) | 主枝配置 `(i·π/3)`、**副枝 `rotation.z = ±Math.PI/4 (+π)`** | ❌ 主枝は正方形断面の棒(ファセットなし)。副枝は凧形(topHeight 0.4 ≠ bottomHeight 0.2)で対辺非平行 | 副枝の長軸が主枝に対し **±45°(左右の開き 90°)**。副枝自体の先端角: 上 ≈ **41.1°**(`2·atan(0.15/0.4)`)/ 下 ≈ **73.7°**(`2·atan(0.15/0.2)`) | ❌ 結晶学的には副枝は隣接 a 軸に平行 = **±60°(開き 120°)** が正。±π/4 → ±π/3 への変更が必要。副枝形状も任意比率 |

### 1.1 個別指摘(依頼事項の明記)

1. **`createBranchWithChildren` の副枝角 `±Math.PI/4`**(`src/geometry/parts.ts`、`createBranchWithChildren` 内の `rotation.z` 代入)
   `petalL.rotation.z = Math.PI/4 + Math.PI`、`petalR.rotation.z = -Math.PI/4 + Math.PI`。副枝の長軸は主枝に対して ±45°、左右の開きは実効 **90°**。樹枝の副枝は隣接 a 軸方向に成長するため、結晶学的には **±60°(開き 120°)= `±Math.PI/3`** が正しい。

2. **`createDiamondPrism` / `createMiniDiamondPrism` の任意比率**(`src/geometry/parts.ts:35-81, 129-173`)
   - `createDiamondPrism`: topHeight 1.5 / bottomHeight 0.4 / width 0.8 → 先端角 上 29.9° / 下 90.0°
   - `createMiniDiamondPrism`: topHeight 0.4 / bottomHeight 0.2 / width 0.3 → 先端角 上 41.1° / 下 73.7°
   いずれも凧形で対辺非平行、寸法は見た目調整の任意値であり、エッジ方位・先端角とも {10-10} 面のトレース(60° 系列・内角 120°)に由来しない。
   (未使用の `createSmallDiamondPrism` も同型: 先端角 上 53.1° / 下 90.0°。)

3. **扇形ケースの tilt コメント不一致**(`src/geometry/morphologies.ts:90`)
   `const tilt = -Math.PI / 2; // -45度で倒す` — 実値は **-90°** なのにコメントは「-45度」。コードが正(花弁を XZ 平面に寝かせるには -90° が必要)で、コメントが誤り。

### 1.2 補足(表外の所見)

- `parts.ts` の `createFanShape` / `createSmallDiamondPrism` / `createRedTriangularPrism` / `createMainBranch` / `createSubBranch` / `createMainBlade` / `createFanHexGeometryFilled` / `createHexRingFrame` は `buildMorphology` から未使用(旧実装の忠実移植残り)。共通化の際の移行対象からは除外可能。
- `createFanHexGeometryFilled` の凹み頂点は `dentRatio = 0.35` による角度分割で、凹みエッジの方位も 60° 系列に載らない(現状未使用のため実害なし)。
- `createRedTriangularPrism` は 3 分割 Cylinder(正三角形 = 内角 60°)。氷 Ih に三方晶の {11-20} 由来三角板は実在するが、現行 9 形態では未使用。
- `classify.ts` / `createSnowCrystal.ts` には角度・幾何の定義はなく、結晶学的問題なし(形態選択とディスパッチのみ)。

## 2. {10-10} 整合 2D アウトライン共通化 — 設計案

共通の前提(全案共通):

- **a 軸 3 方向の定義**: 底面(コード上は XZ 平面、Shape 生成時は XY)内で `a1 = 0°, a2 = 120°, a3 = 240°`。成長方位(六角形の頂点方位・枝の伸長方位)は `±a1, ±a2, ±a3` の 6 方位 = `k·60°` (k = 0..5)。
- **許容エッジ方位**: 頂点を `k·60°` 方位に置くとき、{10-10} トレースであるエッジの線方位も `k·60°` 系列、エッジ法線は `30° + k·60°` 系列に載る。
- **凧形の置換先**: 先端を持つ枝・花弁は「**伸長六角形**」(長軸方向に伸ばした六角形: 平行な長辺 2 本 + 軸から ±60° の先端エッジ 4 本)にする。全内角が 120° になり、先端角 120°・対辺平行・{10-10} 整合の 3 条件を同時に満たす。先端三角部の長さは `tipLen = (width/2) / tan(60°)` で幅から一意に決まる。

### 案 A: 最小定数 + 生成ヘルパー(`src/geometry/crystallography.ts`)

- **内容**: 定数 `A_AXES = [0, 2π/3, 4π/3]`、`GROWTH_DIRS = k·π/3`、`SIDE_BRANCH_ANGLE = π/3` と、2 つの生成関数のみ:
  - `hexOutline(radius): THREE.Shape` — 正六角形
  - `elongatedHexOutline(length, width): THREE.Shape` — 伸長六角形(先端エッジを軸 ±60° にハードコード)
  これを `ExtrudeGeometry` に渡す薄いヘルパー `extrudeOutline(shape, thickness)` を添える。
- **頂角 120° の保証方法**: 生成関数内部で角度リテラルを `±Math.PI/3` のみに限定し、自由パラメータは長さ・幅だけ(先端長は幅から導出)。関数単位の保証。
- **移行手順**:
  1. `createDiamondPrism` / `createMiniDiamondPrism` の手書き BufferGeometry(12 頂点)を `elongatedHexOutline` + 押し出しに置換(寸法は現行の length/width を踏襲)。
  2. `createBranchWithChildren` の `±Math.PI/4` を `±SIDE_BRANCH_ANGLE`(±π/3)に変更。
  3. `morphologies.ts:90` のコメントを「-90度で倒す(XZ 平面へ)」に修正。
  4. 六角柱系 6 形態は `CylinderGeometry(…, 6)` のまま(既に整合)。
- **評価**: 差分最小で「忠実移植」方針と両立。ただし保証はヘルパーを使った箇所に限られ、任意 Shape を直接書けば破れる。

### 案 B: ターン制約付きアウトラインビルダー(構成的保証)

- **内容**: `class HexOutlineBuilder` — 内部状態は現在方位インデックス(0..5、実角 = `index·60°`)。API は `forward(len)` / `turnLeft()` / `turnRight()`(±60° 固定)/ `close()`(閉路と回転総和 ±360° を検証)/ `toShape()`。
- **a 軸の定義**: 方位インデックス 0/2/4 を a1/a2/a3 と文書化。`fromAxis(axisIndex)` で開始方位を指定。
- **許容エッジ方位**: API 上 6 方位しか表現できないため、定義により全エッジが 60° 系列。
- **頂角 120° の保証方法**: ターンが ±60° しか存在しないので、全内角は 120°(凸)または 240°(骸晶の凹部)に**構成的に**限定される。検証ではなく表現不能性による担保。
- **移行手順**:
  1. `hexOutline` = 6 × (`forward`, `turnLeft`) で正六角形を再現し、`CylinderGeometry(…, 6)` 製形態とスナップショット比較。
  2. 伸長六角形(枝・花弁)を builder で定義し、案 A の手順 1–3 と同じ置換。
  3. 骸晶系の凹み(現行は Box 貼り付け)を 240° 凹角を含む単一アウトライン + 押し出しに段階移行。
  4. 未使用 `createFanHexGeometryFilled` の dent 形状を builder で再設計(将来の扇形改良用)。
- **評価**: 将来形態を追加しても自動的に整合する最も堅い案。ただし頂点配置が変わり見た目差分が出るため、リライト量・検証コストは最大。

### 案 C: 形態テンプレート層(影響範囲を 2 形態に限定)

- **内容**: 案 A の定数に加え、問題のある形態専用のテンプレート 3 つだけを置く:
  - `armOutline(length, width)` — 樹枝の主枝・副枝(伸長六角形)
  - `sectorPetalOutline(length)` — 扇形花弁(先端 120°、幅は長さから導出)
  - `hexPlateOutline(radius)` — 整合確認用の参照実装
- **頂角 120° の保証方法**: テンプレート内部の角度リテラルを `±Math.PI/3` のみとし、ユニットテストで生成 Shape の全頂点内角 == 120° をアサート(`getPoints()` から隣接エッジのなす角を検算)。
- **移行手順**:
  1. 扇形・樹枝状の 2 形態のみテンプレートへ置換(`createDiamondPrism` → `sectorPetalOutline`、`createMiniDiamondPrism` → `armOutline`、`±π/4` → `±π/3`)。
  2. 六角柱系 6 形態 + 針は CylinderGeometry のまま現状維持。
  3. コメント不一致(`morphologies.ts:90`)の修正のみ同時実施。
- **評価**: 修正が必要な箇所(扇形・樹枝状)に影響を限定でき、第一段階として最小リスク。共通化の射程は狭いので、後で案 B へ発展させる余地を残す。

**推奨**: まず**案 C** で問題 2 形態を是正し、骸晶系の凹み表現まで作り直す段階になったら**案 B** へ拡張する 2 段階アプローチ。
