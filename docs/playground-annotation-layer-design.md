# 案 N 設計書: 結晶学注記レイヤー — playground トグル表示

snowcrystal / playground に結晶学注記(軸・面・角度)のトグルレイヤーを追加する。**コード変更なし・設計のみ**(CP-N1)。
状態: 起案(2026-06-11、チャット検収待ち)/ ブランチ: feature/phase3 / 親文書: docs/crystallography-audit.md・docs/geometry-caseB-design.md・docs/geometry-caseM-design.md

## 1. 目的と対象

- **目的(9 月実演の柱)**: 監査シリーズで確立した結晶学的整合 — {10-1̄0} 全内角 120°・副枝 ±60° = 隣接 a 軸平行・花形断面の凹角 240° — を**画面上で自己証明**できるようにする。スクショ 1 枚で「この実装は a 軸基準の角度制約を満たす」と示せることがゴール。
- **対象**: 単一形態モード(スライダー / 手動の両対応 — 表示中の `currentMorph` に追従)。**成長パスモード・冠柱は N2 では対象外**(§3 末尾・裁量 2)。
- CP 分割: **N1 = 本設計 / N2 = 実装+目視+CHANGELOG+引き継ぎ更新を一括**(§6)。

## 2. 現状精読 — 方位規約の確定(本設計の本丸)

### 2.1 方位規約(ソース根拠つき)

世界方位を **φ = atan2(z, x)**(XZ 平面、deg)と定義する。以下 R1〜R7 を注記配置の唯一の根拠とする:

| # | 規約 | ソース根拠 |
|---|---|---|
| R1 | **c 軸 ∥ +Y**(柱・板系の全形態) | CylinderGeometry は Y 軸柱。案 B 押し出しも `geo.rotateX(Math.PI / 2)` で +Y へ(morphologies.ts:83 `dentedHexColumn`、同 450 リップリング「c 軸 +Y へ」) |
| R2 | **Cylinder 族の a 軸方位 = 30° + k·60°**(角頂点方向) | morphologies.ts:202「+30°位相: CylinderGeometry(6分割)の頂点方位(30° mod 60°)= a軸〈11-20〉に整合」(扇形)。Θ0 = π/6(morphologies.ts:306)はこの頂点位相の較正定数(針の rotation.y = −φ_i + Θ0、同 324/331) |
| R3 | **builder 族(案 B 花形断面)の角頂点方位 = 0° + k·60°** | HexOutlineBuilder は方位 d = 0 開始・d = 0/2/4 = a1/a2/a3(hexOutlineBuilder.ts §1.1 規約)。dentedHexOutline の下地六角形は第 1 辺が +x 沿い → 中心正規化後の角頂点は 0° + k·60° |
| R4 | **樹枝族の腕 = a 軸方向(30° + k·60°)** | 腕の角 angle = i·60°(morphologies.ts:229 樹枝状・56 buildDendriteFamily)を **parts.ts:351 `group.rotation.y = -angleRad`**(createBranchWithChildren 末尾)が適用 — 主枝 +Z(φ=90°)が 90° + i·60° ≡ 30 (mod 60) へ。中心 Cylinder の角頂点(R2)と整合 |
| R5 | **副枝 = 主枝 ±60°(隣接 a 軸平行)** | parts.ts:340/344 `petal.rotation.z = ±Math.PI / 3`(v1-to-v2 #1 の修正点) |
| R6 | **砲弾集合 = 腕ごとの c 軸が放射方向(seed 依存)** | createBullet はローカル +Y = c 軸、quaternion で腕方位へ(parts.ts createBulletRosette)。錐面は {10-1̄1}(hexPyramidApexHeight = R·c/a、crystallography.ts:76・ICE_C_OVER_A 同 22) |
| R7 | **側面 = 例外: 共通スパイン(a 軸)∥ +Y** | parts.ts:139-146(フィンのスパイン = ローカル +Y)・257「共有スパイン(+Y)まわりの二面角」。**c 軸はフィンごとに水平面内**。c ∥ +Y の例外は**側面(R7)と砲弾集合(R6 — 腕ごとに c 軸が放射方向)の 2 形態**(いずれも凍結雲粒起源の多結晶) |

A_AXES(crystallography.ts:9-13)は基底面内の a 軸**線方位** 0°/60°/120°(mod 180°)であり、R2/R3 の位相はその上に乗る「どの 60° 系列か」を族ごとに定める定数である。

### 2.2 実装時判明 F1 — 族間の 30° 位相差(本設計の重要発見)

CP-N1 で**機械検証**(vitest 一時ハーネス、頂点方位の mod 60° 監査)した結果:

- Cylinder 族の角頂点 ≡ **30°** (mod 60°) / builder 族(案 B 花形)の角頂点 ≡ **0°** (mod 60°) — **両族の格子方位は世界座標で 30° ずれている**。
- 帰結: **さや・針は両族混在**(外殻 = builder 族 0° / 内側透明レイヤー・針 12 本 = Cylinder 族 30°)で、**内外の格子位相が 30° 不整合**(実測: 外殻 0° vs 内層 30°)。単独表示では気づきにくい(内層は opacity 0.3)が、注記レイヤーが a 軸矢印を引くと顕在化する。
- 案 N での扱い(裁量 1): 注記は**形態ごとに正しい族位相**で描く。さや・針は**花形断面の主柱(さや = 最外層 i=0 / 針 = 中心柱。いずれも builder 族 0° 基準)**を正とする。不整合自体の解消は src 変更(例: dentedHexColumn に rotateY(π/6) を足して builder 族を 30° 位相へ揃える)が必要で、**案 N の不可触制約(§5)に反するため将来 CP(案 B 追補)として記録**するに留める。なお不整合の重さは形態で異なる: さやは単結晶の内外につき 30° ずれは要修正だが、針の 12 本は独立結晶のクラスタと解釈すれば方位差に物理的許容の余地がある(中心柱との関係と表現の一貫性からは揃えるのが無難)。将来 CP での修正範囲判断はこの区別を踏まえる。

### 2.3 playground の構成(CSS2DRenderer 併設の影響範囲)

- レンダラー: `WebGLRenderer({ canvas, antialias: true })`(main.ts:78)、canvas は `#scene`(main.ts:62、index.html:394)。CSS はデスクトップで `position: fixed; inset: 0; z-index: 0`(index.html:49-56)だが、**`@media (max-width: 768px)`(index.html:316)で `position: static; height: 52vh` の文書フロー内ブロックに上書きされる**(index.html:346-355)— オーバーレイ設計はこの両レイアウトに追従する必要がある(下記②)。
- パネル DOM: 操作・情報パネルは `.panel` 要素で **z-index: 10**(index.html:66・291)。トグルチェックボックス(§4.4)は操作パネル(モードスイッチ〜形態セレクトのセクション)に追加する。
- OrbitControls: `three/examples/jsm/controls/OrbitControls.js` から import(main.ts:5)・生成(main.ts:83)。
- リサイズ: `resizeToCanvas()`(main.ts:774-780、`renderer.setSize(w, h, false)` + camera 更新)を ResizeObserver(main.ts:783-784)と window resize(main.ts:785)が呼ぶ。
- ループ: `animate()` 内 `requestAnimationFrame`(main.ts:791)→ `renderer.render(scene, camera)`(main.ts:793)。
- メッシュ差し替え: `swap(next)`(main.ts:201-208、remove → disposeCrystal → add)。**注記グループの再構築フックはここ**(swap 後に現形態の注記を組み直す)。
- パネルは 日本語 / English 併記(main.ts:229-231・260)。
- CSS2DRenderer 併設の影響範囲(すべて playground 内): ① import 追加(`three/examples/jsm/renderers/CSS2DRenderer.js` — OrbitControls と同経路、three 0.160.1 に存在確認済み)② オーバーレイ div(`pointer-events: none;` **z-index は canvas(0)とパネル(10)の間 — 例 1**)。配置は固定値でなく **`canvas.getBoundingClientRect()` への矩形同期**とする(デスクトップ = fixed 全面 / モバイル = 文書フロー内 52vh の両レイアウトに追従。同期は `resizeToCanvas` — ResizeObserver が canvas を監視済み(main.ts:783-784)— と、モバイル時のスクロールずれ対策の scroll リスナーで行う)③ `resizeToCanvas` に `css2d.setSize(w, h)` + 矩形同期を追加 ④ `animate` に `css2d.render(scene, camera)` 追加。

## 3. 注記内容 — 14 形態 × {軸 / 面 / 角度} 対応表

共通: **c 軸**矢印と **a₁a₂a₃ 軸**矢印 3 本+ラベル(a 軸位相は族で切替、R2/R3)。例外 2 形態 — **砲弾集合**(R6: 腕ごとの c 軸 → 代表 1 腕のみ・全体共通の a 軸なし)と**側面**(R7: スパイン = a 軸 ∥ +Y・c 軸はフィンごと)— は表の個別行どおり限定注記(裁量 3)。

| 形態 | 族(a 軸位相) | 軸 | 面ラベル | 角度注記 |
|---|---|---|---|---|
| 角板 | Cylinder(30°) | c+a | {0001} 基底面・{10-1̄0} 柱面 | 内角 120° |
| 厚角板 | Cylinder(30°) | c+a | 同上 | 内角 120° |
| 骸晶角板 | Cylinder(30°) | c+a | {0001}・{10-1̄0}(最外層基準) | 内角 120° |
| 角柱 | Cylinder(30°) | c+a | {0001}・{10-1̄0} | 内角 120° |
| 長柱 | Cylinder(30°) | c+a | {0001}・{10-1̄0} | 内角 120° |
| 骸晶角柱 | **builder(0°)** | c+a | {0001}(窪み端面)・{10-1̄0} | 内角 120° + **凹角 240°**(案 B) |
| さや | **builder(0°)**(外殻基準、F1) | c+a | {10-1̄0}(外殻) | 凹角 240° |
| 針 | **builder(0°)**(中心柱基準、F1) | c+a | {10-1̄0}(中心柱) | 凹角 240° |
| 扇形 | Cylinder(30°) | c+a | — | 花弁方位 = a 軸(30° + k·60°) |
| 樹枝状 | Cylinder(30°) | c+a | — | 腕 = a 軸 + **副枝 ±60°(= 隣接 a 軸平行、v1-to-v2 #1)** |
| 星状 | Cylinder(30°) | c+a | — | 腕 = a 軸(副枝なしの対照を一文注記) |
| 羊歯 | Cylinder(30°) | c+a | — | 腕 = a 軸 + 副枝 ±60°(5 対) |
| 砲弾集合 | 腕ごと(R6) | 代表 1 腕の c 軸のみ | **{10-1̄1} 錐面**(先端) | 錐面と軸の角 28.0°(crystallography 定数) |
| 側面 | 例外(R7) | **スパイン = a 軸(+Y)** | — | 二面角 70.3°(CSL 双晶角)注記 |

- 砲弾集合・側面は seed 依存方位のため全要素への注記は煩雑 → 代表要素への限定注記(裁量 3)。
- **冠柱・成長パスモード**: N2 では対象外。パスモード選択中はトグルを disabled にする(冠柱は 2 形態合成で注記が二重になり、9 月実演の単一形態ストーリーからも外れるため。将来 P 系 CP で扱う — 裁量 2)。

## 4. 技術方式

### 4.1 ラベル描画: CSS2DRenderer(推奨)vs Sprite

| 観点 | CSS2DRenderer | Sprite(canvas テクスチャ) |
|---|---|---|
| 文字品質 | DOM テキスト — ズームでも常に鮮明 | テクスチャ解像度依存(DPR 対応が手作業) |
| 日本語/English 併記 | 既存パネルと同じ CSS で 2 行表示が容易 | canvas 描画コードを自作 |
| オクルージョン | **されない(常に手前)** — 注記用途では許容 | 深度テストあり(隠れる) |
| 実装コスト | renderer 併設(§2.3 の 4 点)のみ | テクスチャ生成・破棄管理が増える |
| import 経路 | three/examples/jsm(OrbitControls と同経路・実績あり) | three 本体のみ |

→ **CSS2DRenderer を推奨**。ラベルは `CSS2DObject`(中身は `<div class="annot">` で ja/en 2 行)。

### 4.2 矢印・角度弧

- 軸矢印: **THREE.ArrowHelper**(c 軸 1 本 + a 軸 3 本。長さは形態の包絡半径 × 1.3、色分け: c = 既存 stage② 系 / a = stage① 系の流用を候補)。
- 角度弧: **THREE.EllipseCurve → BufferGeometry → THREE.Line**(120°/240°/±60° とも同方式。弧の中点に CSS2DObject で「120°」等)。ArrowHelper も Line も three 本体のみで完結。
- 注記一式は単一の `annotGroup: THREE.Group` に組み、`swap()` 後に現形態のレコードから再構築・トグル OFF で `annotGroup.visible = false`(dispose はレコード切替時)。

### 4.3 配置は方位規約定数からの計算のみ(保守性)

- **メッシュ内部の走査に依存しない**。§2.1 の R1〜R7 + 形態ごとの包絡定数(半径・高さ — LABELS と同じ「表示専用の最小コピー」方針で playground 側にテーブル化)から全座標を計算する。
- 注記対応表は **playground/annotations.ts**(新規・playground 内独立モジュール)に純データ + 純関数で置く(裁量 5): `ANNOTATIONS: Record<Morphology, AnnotationSpec>`(族位相・包絡・注記項目)。union 14 値の `Record` 網羅により**形態追加時に tsc が注記漏れを検出**(案 M の LABELS と同じ仕組み)。

### 4.4 トグル UI・表記

- パネル(操作セクション)にチェックボックス「結晶学注記 / Annotations」を追加。**既定 OFF**(裁量 4)。パスモード中は disabled(裁量 2)。
- 表記は既存パネルの **日本語 / English 併記**に合わせる。ミラー指数は既存 docs と同じ Unicode 表記({10-1̄0}・{0001}・{10-1̄1})。

## 5. 制約(重要)

- **src/ は一切触らない** — 追加 import・新規ファイルとも playground のみ。**dist MD5・d.ts MD5 とも基線 #3(dist `2e7a1f659447357ed0ad9cf4a4a5839c` / d.ts `68a07ca8a7a574a2a140a603e3d4ec38`)不変が本シリーズのゲートの柱**。
- F1(§2.2)の解消は src 変更を要するため本シリーズでは行わない(将来 CP として引き継ぎに記録)。
- テストは現状踏襲: playground にユニットテストなし → **playground tsc ゲート + 目視**。vitest の include は src のみのため annotations.ts は現状ユニットテスト対象外。テスト可能化の具体経路(裁量 5): **(a) N2 で vitest 設定の include に `playground/annotations.test.ts` を追加**(playground 内で完結・src 不可触は維持。注記対応表の 14 形態網羅・位相値 ∈ {0, π/6}・角度値 ∈ {120, 240, ±60, 28.0, 70.3} の整合を検証可能)、(b) 将来 0.3.x で注記データを src へ昇格(公開面の判断を伴うため別 CP)。N1 では (a) を N2 の裁量(実装するか tsc+目視に留めるか)として提示。既存 89 件は無変更パスが条件。

## 6. ゲート方式と CP 分割

- **CP-N1【Extra】**(本書): 設計書起案・検収。ゲート = 全定型 + dist/d.ts MD5 **基線 #3 不変**照合(docs のみ)。コミットはチャット検収後。
- **CP-N2【MAX・単独セッション推奨】**: 実装(annotations.ts + main.ts 統合 + index.html チェックボックス/CSS)+ **目視 2 段停止**(ゲート → dev サーバー → スクショ判定: 全 14 形態の注記 — 特に ① 樹枝族の ±60° ② 案 B 3 形態の 240° ③ F1 で警告した a 軸位相の族別正しさ ④ 注記 OFF で従来表示に完全復帰)+ **CHANGELOG(ブランチ節 Added (playground))+ 引き継ぎ更新を同一 CP でクローズ一括**。ゲート = 全定型 + playground tsc + **dist/d.ts MD5 基線 #3 不変**(src 不可触の機械的証明)。
- 判定記録・採用値はコミット本文に永続化(c40ec0a・760ddeb 方式)。
