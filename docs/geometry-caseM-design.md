# 案 M 設計書: 単体形態の近似解消 — 星状・羊歯・長柱(CP-M シリーズ)

snowcrystal / 条件図 17 領域のうち専用ジオメトリを持たない 3 領域への専用描画付与。**コード変更なし・設計のみ**(CP-M1)。
状態: 起案(2026-06-11、チャット検収待ち)/ ブランチ: feature/phase3(0.3.0 系)/ 親文書: docs/phase2-ml66-diagram-design.md(ML66 図)・docs/geometry-caseB-design.md(ゲート方式の前例)

## 1. 目的と対象

### 1.1 対象 3 領域

| 領域 | mlCode | 現状の描画 | fidelity | 専用化の方向 |
|---|---|---|---|---|
| 星状 | ml66/P1d | 樹枝状で近似 | approx | 樹枝状のパラメタ族(副枝なし) |
| 羊歯 | ml66/P1f | 樹枝状で近似 | approx | 樹枝状のパラメタ族(副枝を密・長め) |
| 長柱 | ml66/N1e | 角柱で近似 | approx | 角柱の寸法族(高アスペクト) |

### 1.2 対象外(明記)

- **広幅枝 P1c(現: 扇形 approx)・側面 S2(現: S1 と同レンダラ approx)は本シリーズの対象外。** いずれも専門家確認事項 (1)(扇形/広幅セクターの解釈)・(5)(側面領域の縦位置)と連動するため、回答前の専用化は手戻りリスクが大きい。後続の「仮実装シリーズ」で扱う。
- 結晶学注記レイヤー・雲断面ビュー等の Phase 3b 候補は本シリーズと独立(引き継ぎ §3)。
- CP-M シリーズ: **M1 = 本設計 / M2 = 実装+目視 / M3 = クローズ**(§7)。

## 2. 現状精読(2026-06-11、HEAD 19ecd99)

### 2.1 樹枝状ビルダーの構成

`buildMorphology('樹枝状')`(src/geometry/morphologies.ts)+ `createBranchWithChildren(angleRad)`(src/geometry/parts.ts):

- 中心: `CylinderGeometry(0.5, 0.5, 0.2, 6)`、COLORS.base。
- 腕 6 本: `createBranchWithChildren(i·60°)` を i = 0..5 で配置(`group.rotation.y = −angleRad`)。
- 主枝: `createElongatedHexPrism(width 0.08, length 2.1, thickness 0.08)` を `rotation.x = π/2` で XZ 平面に寝かせ長軸 +Z。原点 = 基部頂点(中心柱内に隠れる)。
- 副枝: 3 対。`offsetZ = 0.5·(i + 1.5)` = 0.75 / 1.25 / 1.75、`createElongatedHexPrism(0.3, 0.6, 0.05)`、`rotation.z = ±π/3`(先端外向き ±60°・開き 120°)、接合点 `joinX = 0.04` = 主枝半幅。
- マテリアル: createElongatedHexPrism 内で COLORS.wing + flatShading 固定。
- **{10-10}/60° 系列整合の取り方**: 輪郭は `elongatedHexOutline`(crystallography.ts — 全内角 120°・対辺平行・エッジ方位 60° 系列を構成的に保証、v1-to-v2 #2・#3・#4b で確立)。副枝 ±60° = 隣接 a 軸に平行(#1)。腕間隔 60°。主枝先端 z=2.1 が最外副枝先端 z=2.05 を 0.05 リード。

### 2.2 角柱ビルダーの寸法

- `CylinderGeometry(0.4, 0.4, 1.5, 6)` + EdgesGeometry(COLORS.edge)、COLORS.base + flatShading。
- 半径 0.4 / 高さ 1.5 → **アスペクト比 H/D = 1.5/0.8 = 1.875**。
- 参考(同族): 厚角板 (0.6, 0.6, 0.4, 6) H/D ≈ 0.33 / 冠柱(growth)の柱 R 0.45・L 1.6。

### 2.3 region→morphology 割当と Morphology union の現状

- union(src/types.ts、**現 11 値**): 角板・角柱・針・さや・骸晶角柱・厚角板・骸晶角板・扇形・樹枝状・砲弾集合・側面。
- 割当(src/diagram/ml66.ts): `ml66/P1d` → 樹枝状(approx・labelJa 星状)/ `ml66/P1f` → 樹枝状(approx・labelJa 羊歯・source 'provisional'・confidence low)/ `ml66/N1e` → 角柱(approx・labelJa 長柱・source 'ML66 §3.1(Shimizu)')。
- union 消費箇所: `TITLE_MAP: Record<Morphology, …>`(classify.ts — **網羅必須のため union 拡張でコンパイルエラーが新値の書き忘れを防ぐ**)/ `getSubtypeCode`・`getGlobalLabel`(if/switch、default '' あり)/ `buildMorphology`(default フォールバックあり)/ growth の REGION_CLASS は **region id キー**のため形態変更の影響なし。

## 3. 設計案

### 3.1 星状・羊歯 = 樹枝状のパラメタ族化

`createBranchWithChildren(angleRad, opts?: DendriteArmOptions)` に拡張し、現行値をデフォルト定数に据える(**針の rotation.y 方式**: 現行挙動を明示定数化し、テストで固定):

```ts
export interface DendriteArmOptions {
  mainWidth?: number;     // 主枝幅
  mainLength?: number;    // 主枝長
  mainThickness?: number; // 主枝厚
  sideCount?: number;     // 副枝対数(0 = なし)
  sideSpacing?: number;   // 副枝間隔
  sideStart?: number;     // 先頭副枝の位置係数(offsetZ = spacing·(i + sideStart))
  sideWidth?: number;     // 副枝幅
  sideLength?: number;    // 副枝長
  sideThickness?: number; // 副枝厚
}
export const DENDRITE_ARM_DEFAULTS = {
  mainWidth: 0.08, mainLength: 2.1, mainThickness: 0.08,
  sideCount: 3, sideSpacing: 0.5, sideStart: 1.5,
  sideWidth: 0.3, sideLength: 0.6, sideThickness: 0.05,
} as const; // 現行値そのまま — 樹枝状(P1e)の出力ビット不変が目標
```

- **樹枝状(P1e)**: `createBranchWithChildren(angle)`(opts なし)→ デフォルト適用で**現行出力とビット同一**を目標。生成順・演算順を変えない(opts の分岐はデフォルトマージのみ)。DENDRITE_ARM_DEFAULTS の値と '樹枝状' の構造署名を vitest で固定(§5)。
- **星状(P1d、stellar crystal)**: 細い 6 本主枝・副枝なし。初期パラメタ = `{ sideCount: 0 }` のみ(最小差分 — 主枝・中心は樹枝状と共通)。主枝長の微調整(1.8〜2.1)は M2 目視判定の余地として残す。
- **羊歯(P1f、fernlike crystal)**: 副枝を密・長めに。初期パラメタ案 = `{ sideCount: 5, sideSpacing: 0.3, sideStart: 1.0, sideLength: 0.75, sideWidth: 0.22 }`(offsetZ = 0.3〜1.5 の 5 対 — シダの羽状感)。確定は M2 目視。副枝先端の隣接腕への干渉有無は M2 で確認(必要なら sideLength を上限制約)。最内副枝(offsetZ 0.3)は基部が中心六角柱(外接半径 0.5)内に埋まるが、これは主枝基部と同じ「接合部は埋め込み」の既存流儀による意図的なもの(先端 z ≈ 0.68・横 ≈ 0.69 は中心外に出る)。視認は M2 目視で確認。
- いずれも中心六角柱(0.5/0.2)・±60° 副枝・elongatedHexOutline は共通 — **{10-10} 整合は族全体で構成的に維持**される(新しい角度自由度を導入しない)。

### 3.2 長柱 = 角柱の寸法族

構成は角柱と同一(CylinderGeometry(…, 6) + EdgesGeometry、COLORS.base + flatShading)。v1 に長柱はないため新規寸法(ML66 N1e = long solid column、Shimizu。南極での観測形態 — 中実のまま c 軸方向に伸長):

| 案 | 半径 R | 高さ H | H/D | ねらい |
|---|---|---|---|---|
| **案 1(推奨)** | 0.25 | 2.0 | 4.0 | 全高を針・さや族(2.0)と揃え、角柱(1.875)の 2 倍超のアスペクトで「長柱」が一目で立つ |
| 案 2 | 0.3 | 2.7 | 4.5 | 量感重視(画面占有が最大。他形態よりやや大きい) |
| 案 3 | 0.2 | 2.2 | 5.5 | 細長比最大(Shimizu の記載に最も寄る。遠目で針と紛れるリスク) |

比の確定は **M2 の目視判定**((−33, 0.05) で角柱・針と並べ比較)。

### 3.3 union・割当の変更

- `Morphology` union に **'星状'・'羊歯'・'長柱'** を追加(11 → 14 値)。
- ml66.ts: P1d/P1f/N1e の morphology を専用値へ変更し、**fidelity を approx → exact** に更新(P1f の source 'provisional'・confidence 'low' は据え置き — 描画の専用化と図上範囲の確度は別問題)。
- buildMorphology に 3 case 追加('星状'・'羊歯' = パラメタ族呼び出し / '長柱' = 寸法族)。
- classify.ts: `TITLE_MAP` に 3 エントリ追加(案: 星状 Stellar Crystal / 羊歯 Fernlike Crystal / 長柱 Long Solid Column)。`getSubtypeCode`・`getGlobalLabel` は **''(未割当)のまま**とする — ML66 Fig.2 の領域コード(P1d 等)とグローバル分類(菊地ほか 2012)のサブタイプコード(本リポジトリでは P1c = 骸晶角板 等)は**体系が衝突**しており、安易な割当は砲弾集合・側面で回避した轍を踏む。専門家確認事項 (4) に 3 形態を追補(M3)。
- nakaya-v1.ts(v1 図)は変更しない(v1 の 9 形態のまま)。createSnowCrystal の DEFAULT_MORPHOLOGY('樹枝状')も不変。
- playground: 形態セレクトに 3 option 追加 + 手動モードの強調表示は `regions[].morphology === currentMorph` 連動で自動追従(M2。playground 変更を含むため §7 の追加 tsc ゲート適用)。

## 4. 公開面への影響(重要 — d.ts 基線の更新手順)

- **union 拡張 = d.ts が変わる。d.ts MD5 不変照合(`65ea7f099b6b40b8aa619d617afb8c07`)が初めて破られる系列**になる。方式:
  1. M2 のビルド前に現 d.ts を退避(`cp dist/index.d.ts /tmp/dts-before.d.ts`)。
  2. ビルド後 `diff /tmp/dts-before.d.ts dist/index.d.ts` を取り、**差分が「Morphology union への 3 値追加のみ」であることを確認**(それ以外の差分が出たら停止して報告)。
  3. 新 d.ts MD5 を**基線 #3 として記録** → 以後その基線で不変照合を再開。
- dist MD5 は案 B と同じ「**CP ごとに新基線記録**」方式(現基線 #2 = `6c3ad26146502a1ff9049faf8f761834`)。
- `TITLE_MAP` は `Record<Morphology, …>` のため d.ts 上は型参照のみ — union 以外の textual 差分は生じない見込み(手順 2 で機械確認)。
- **BREAKING**: 0.2.0 の前例(砲弾集合・側面の union 追加)に合わせ、`Morphology` の網羅 switch を持つ利用者コードは更新が必要 → ブランチ CHANGELOG では **BREAKING 扱い**(記載自体は M3)。

## 5. テスト計画(vitest)

新規(目安 +8〜12 件、79 → 87〜91。確定は M2 報告):

1. region 割当更新: P1d → 星状 / P1f → 羊歯 / N1e → 長柱、いずれも fidelity 'exact'(labelJa・source 不変)。
2. 目視定番 3 点の classifyOnDiagram ゴールデン(§6 の region id まで固定、P1d 方式)。
3. **樹枝状ビット不変**: DENDRITE_ARM_DEFAULTS が現行値リテラルと一致 + '樹枝状' の構造署名(children 数・種別・position/rotation・ジオメトリパラメタ)が現行構成と一致(案 B morphologies.test.ts の shapeSignature 流儀)。
4. 星状: 副枝 0(メッシュ数 = 中心 1 + 主枝 6)・主枝が elongatedHex 断面。
5. 羊歯: 副枝対数・offsetZ 系列・±60° 回転。
6. 長柱: CylinderGeometry parameters(R・H・radialSegments 6)と採用アスペクト比、EdgesGeometry 付き。
7. TITLE_MAP 3 エントリ・getGlobalLabel/getSubtypeCode が ''(未割当)を返すこと。
8. buildMorphology 3 値の dispose 正常・同一 seed 決定論(seed 未使用形態だが族の慣例に合わせ確認)。

既存 79 件への影響(見積もり): **修正 2 件・削除 0 件** — ml66.test.ts の「a. 代表条件の分類」([−15, s1.05] 樹枝状 → 星状 / [−33, s0.5] 角柱 → 長柱の 2 行)と「a. 領域メタデータ」(P1d の approx → exact・樹枝状 → 星状 / N1e の 角柱 → 長柱)。growth(REGION_CLASS は region id キー)・nakaya-v1(別図)・lookup(SYNTH 別図)・geometry 系・saturation は無影響。

## 6. 目視定番(チャット側で classifyOnDiagram 実行済みの確定値)

| 形態 | 条件 (T, ρ) | region id | 補足 |
|---|---|---|---|
| 星状 | (−15, 0.23) | ml66/P1d | s ≈ 1.053 ∈ (1.0, 1.12] |
| 羊歯 | (−16, 0.29) | ml66/P1f | s ≈ 1.353 > 1.35 |
| 長柱 | (−33, 0.05) | ml66/N1e | s ≈ 0.527 ≤ 1.0。**0.2.0 既存定番(長柱 −33/0.05)と同値** |

- 帯の狭さ: P1d 帯は −15 °C で **v ∈ (0.2184, 0.2446]**(幅 ≈ 0.026)/ P1f 帯は −16 °C で **v ∈ (0.2893, 0.3]**(スライダー上限まで ≈ 0.011)と極狭。
- **スライダー刻みの実測**(playground/index.html): temperature `min 0 / max 40 / step 0.5`(表示は −値)・vapor `min 0 / max 0.3 / step 0.001`。→ **3 定番とも現行刻みで正確に到達可能**(−15.0 / −16.0 / −33.0、0.230 / 0.290 / 0.050)。P1d 帯は約 25 tick、P1f 帯は約 11 tick の幅があり操作可能。**刻み変更は不要 — M2 範囲に含めない**(プリセット UI は Phase 3b 候補のまま、裁量 #5)。

## 7. ゲート方式と CP 分割

- **CP-M1【Extra】**(本書): 設計書起案・検収。ゲート = 全定型 + dist/d.ts MD5 **不変**照合(docs のみ)。コミットはチャット検収後。
- **CP-M2【MAX・単独セッション推奨】**: 実装(union 14 値・パラメタ族・寸法族・ml66 割当・classify・playground セレクト)+ テスト(§5)+ **目視 2 段停止**(ゲート → dev サーバー → スクショ判定: 星状/羊歯/長柱 + 樹枝状の不変確認 + 他形態デグレなし)。ゲート = 全定型 + **playground tsc**(`npx tsc --noEmit --strict --skipLibCheck --esModuleInterop --forceConsistentCasingInFileNames --target ES2020 --module ESNext --moduleResolution Bundler --lib ES2020,DOM playground/main.ts`)+ dist 新基線記録 + **d.ts 差分確認 → 新基線 #3 記録**(§4 手順)。
- **CP-M3【Normal】**: クローズ — 対応表 A 群 3 行の更新・CHANGELOG(ブランチ Unreleased 節: BREAKING の union 拡張 + Added)・専門家確認 (4) への 3 形態追補・引き継ぎ更新。
- 判定記録・採用値はコミット本文に永続化(c40ec0a 方式)。
