# Phase 3 設計書: 成長パス(環境履歴)モード — 3a MVP

snowcrystal / Phase 3 設計チェックポイント成果物。**コード変更なし・設計のみ**。
状態: 検収済み(2026-06-10、検収論点 1–7 全採用)/ 2026-06-10 / 親文書: docs/phase2-ml66-diagram-design.md(条件図の語彙・規約を継承)

## 0. 目的

1. **「複合型 = 環境履歴の記録」の機能化。** ML66 は「中心部と異なる形の枝を持つ板状結晶は、落下中に温度・湿度の変化を被ったことを示す」とし(§3.4)、Fig. 2 では「温度遷移に対応するグループを上部に、最上段には温度逆転層を通過して落下する型」を配置した(§4)。静的な条件図に動的な型を載せるというこの工夫を、パス入力(条件① → 条件②)として操作できるようにする。
2. **v1 ラベルねじれの構造的解消。** v1 は単一の静的条件に Kikuchi グローバル分類の **P4f(扇付角板)/ P4g(樹枝付角板)= 複合板状結晶のコード**を割り当てていた。ML66 体系での単一条件の対応物は P1b(扇形枝)/ P1e(樹枝状)であり、複合型(ML66 P2f / P2g ≈ Kikuchi P4f / P4g)は §3.4 の「環境変化の記録」である。Phase 3 により「**単一条件 → P1 系 / 2 ステージパス → P2 系**」が定義から分離し、ねじれが解消する(専門家確認 (2) への構造的回答。最終確認は 9 月)。
3. A 先生の科学館エピソード(冠柱 = 柱として生まれ、途中で板の環境に入った結晶)を、そのまま操作できるデモにする(9 月ポスター・BGR の核)。
4. **原則の維持**: 本機能も形態の可視化であり物理成長モデルではない。パスは「環境条件の列」であって時間積分ではない(成長速度・拡散・滞在時間は計算しない)。結晶学が決める量(先端角 120° 系列・面方位・六回対称)は固定し、環境が決める量だけを操作可能にする(過去チャットのモック設計原則を踏襲)。なお枝の本数は ML66 §3.5 により「同一気象条件下の偶然(2 中心核への枝の分配)」なので、パスのパラメータにはしない。

## 1. 一次根拠(ML66、原文確認済み 2026-06-10)

| 節 | 内容(要旨) | 対応コード |
|---|---|---|
| §3.4 | 中心と異なる形の枝を持つ板状結晶 = 落下中の温度・湿度変化の記録。「気象学的に重要な指標」 | P2a–g |
| §3.5 | 2 / 3 / 4 / 12 枝結晶は同一気象条件(2 中心核への枝分配の偶然) | P3, P4 |
| §3.6 | 板状結晶が −20°C 付近の寒気層(温度逆転層)を通過 → 基底面に空間拡張。逆転層の存在指標で、枝の型から逆転層高度を推定可能。放射状型(P7)も −20°C 付近起源 | P6a–d, P7a–b |
| §3.7 | 板状結晶が −10°C 付近の暖かい雲層へ「急落下」 → 枝端に c 軸平行の空間拡張 | CP3a–d |
| §3.8 | 側面系 = −20°C 以深の粉雪。S2/S3 は −25〜−35°C(Weickmann) | S1–S3 |
| Table 1 | **CP1a = Column with plates(冠柱)**、CP1b = Column with dendrites、CP1c = Multiple capped column | CP1a–c |
| §4 | Fig. 2 の構造: 着氷系は左中部、**温度遷移対応グループは上部、最上段 = 温度逆転層を通過して落下する型** | — |

補足:

- 冠柱の成長**順序**(柱 → 板)は ML66 本文に明文はない(Table 1 は型の定義)。「柱が −5°C 前後で成長 → 板領域 −10〜−17°C へ移って両端に板」という中谷以来の標準的説明を採用値とする。→ 専門家確認 (6)
- Kikuchi グローバル分類との対応: Kikuchi P4 系(複合板状)≈ ML66 P2 系。v1 の P4f/P4g、過去チャットモックの例「P4c 角板付樹枝(Dendrite with plates)」はこの系(ML66 では P2c)。
- MKY71 の扱いは Phase 2 方針を踏襲(実装は ML66 原典忠実、MKY71 は注記)。

## 2. スコープ

### 3a(MVP — 本設計の実装範囲)
1. データモデル: `GrowthStage` / `GrowthPath`(**2 ステージ固定**)
2. `classifyGrowthPath(path)` → `PathHit`(各ステージの単独分類 + 複合判定)
3. 複合対応表 v1(data-driven): geometric 1 件(冠柱 CP1a)+ classification-only 数件(§3 の表)
4. 冠柱ジオメトリ `createCappedColumn`(§4)
5. playground 成長パスモード(§5)

### 3b(次期)
- P2 系ジオメトリ(中心と端で形の変わる枝: 樹枝 + 板端 = P2c、板 + 樹枝端 = P2g など)
- 3 ステージ対応、高度ラベル(5 km / 3 km / 1.5 km)、プリセット(「積乱雲コース」など — A 先生エピソードの再現)
- 公開 API 化(0.3.0)と `createSnowCrystal` への統合形の決定

### 対象外(将来予約)
- P6 / P7(空間拡張)・CP3 の専用ジオメトリ(基底面上の立体延長は別設計が必要)
- 滞在時間・成長量・サイズ変調(物理モデル化に近づくため、導入するなら別議論)

## 3. データモデル(`src/growth/`、分類は THREE 非依存)

```ts
export interface GrowthStage {
  temperature: number;       // °C(条件図と同じ)
  supersaturation: number;   // 公開縦軸 0–0.3(条件図と同じ)
}
export type GrowthPath = readonly GrowthStage[];
// 規約: stages[0] = 最初の成長 = 結晶の中心部、最後 = 外周。
//       ML66 Fig.2 の遷移矢印(始点 → 終点)と同じ向き。MVP は length === 2 を要求。

export type RegionClass = 'needle-column' | 'plate' | 'branched' | 'polycrystal';
// regionId → RegionClass の対応表(ml66 の全 region を網羅、テストで担保)
//   needle-column: 針・さや・長柱・角柱・骸晶角柱
//   plate:         角板・厚角板・骸晶角板
//   branched:      扇形・広幅枝・星状・樹枝状・羊歯
//   polycrystal:   砲弾集合・側面(多結晶系。MVP の複合対応表では from/to に使わない)

export interface CompositeEntry {
  id: string;                  // 'composite/CP1a'
  mlCode: MlCode;              // 'CP1a'
  labelJa: string;             // '冠柱'
  from: RegionClass;
  to: RegionClass;
  morphology: '冠柱' | null;   // 専用ジオメトリあり | null = 分類のみ
  fidelity: 'exact' | 'approx';     // DiagramRegion と同語彙
  source: string;              // 'ML66 Table 1 + 標準解釈' | 'ML66 §3.4' など
  confidence: 'high' | 'mid' | 'low';
}

export interface PathHit {
  stages: RegionHit[];              // classifyOnDiagram(既定 ML66)を各ステージに適用
  composite: CompositeEntry | null; // 対応表に該当なし = null(描画は最終ステージの形態)
}
```

複合対応表 v1(掲載エントリ):

| from → to | エントリ | morphology | source | confidence |
|---|---|---|---|---|
| needle-column → plate | CP1a 冠柱 | '冠柱'(geometric) | ML66 Table 1 + 標準解釈 | mid |
| needle-column → branched | CP1b(樹枝付柱) | null | ML66 Table 1 | mid |
| branched → plate | P2a / P2c 系(端に板) | null | ML66 §3.4 | high |
| plate → branched | P2g 系(端が樹枝化) | null | ML66 §3.4 | high |
| plate / branched → needle-column | CP3 系(端に c 軸拡張) | null | ML66 §3.7 | high |

- **`'冠柱'` は `Morphology` union に追加しない**(別型 `CompositeMorphology` とする)。`createSnowCrystal({ morphology: '冠柱' })` は 3a では非対応。0.2.0 凍結中に公開 union の変更を暗黙に積まないため。union への統合は 0.3.0 で判断。
- 同クラス内パス(plate → plate など)は composite null。polycrystal クラスを含むパスも MVP では null(S3 などの複合表現は将来)。
- riming 帯(全領域より上)は lookup のクランプ規約に従い特別扱いしない。

## 4. 冠柱ジオメトリ `createCappedColumn`

- 構成: 既存部品の合成 — 中央 hex 柱 1 本 + 両端 hex 板 2 枚。**c 軸共有**(冠柱は単結晶: 柱と板は同一 c 軸・同一 a 軸方位。回転双晶冠柱はレアのため対象外)。
- 板の中心面 = 柱の端面(端面上に板が広がる)。
- パラメタ(目安、最終値は実装時に既存形態と実測比較して一任 — 砲弾・側面と同方式): R_c ≈ 0.45 / L_c ≈ 1.6 / R_p ≈ 1.1(> R_c)/ t_p ≈ 0.12。
- group 構造: children = [柱, 上キャップ, 下キャップ] の固定順 + 各 Mesh に `userData.part: 'column' | 'cap'`。**パッケージのマテリアルは従来どおり単色**で、playground だけが userData を使ってステージ色に塗り分ける。
- seed: 引数としては受けるが MVP では未使用(冠柱は規則形。ジッタは導入しない)。
- 配置: c 軸 = ローカル Y(柱系の既存規約に合わせる)。

## 5. playground 成長パスモード(過去チャットのモック設計を正とする)

- モード切替: 既存「スライダー / 手動」に第 3 の「成長パス」を追加。
- 図上クリック 1 回目 = ステージ①(○)、2 回目 = ステージ②(●)、① → ② の矢印(Fig. 2 の遷移矢印のオマージュ)。点はドラッグで移動可。
- スライダーは**増やさない**: 既存 2 本を「選択中ステージ」に束ねる(点クリックで選択切替)。スライダー 2〜3 セット積みは過去検討で却下済み(画面密度の破綻・「スライダーとダイアグラム同一視野」原則との衝突)。
- ステージ色: ① `#5DCAA5` ② `#85B7EB`(モックの配色)。3D 結晶は userData.part で中心部(柱)= ①色 / キャップ = ②色 — **playground のみ**。
- 情報パネル: ステージ①行・②行(従来の形態 / Region 表示)+ 複合行
  - 該当あり: 「複合型: 冠柱 (CP1a) — ML66 Table 1」
  - classification-only: 「複合型: P2g 系(専用描画なし — 最終条件の形態で表示)」
  - 該当なし: 「複合型: —」
- 高度ラベル・プリセット(積乱雲コースなど)・3 ステージは 3b。
- 「結晶学が決める量(先端角・面方位・六回対称)は固定」の注記文言は 3b でパネルに追加予定。

## 6. API・ブランチ方針(0.2.0 凍結との両立)

- **feature/phase3 ブランチで実装**し、main は 415e941(0.2.0 リリース可能状態)のまま保護。0.2.0 publish 後に main へマージ。
- 3a の間、`src/index.ts` には**追加しない**(公開 API 面 = README の不変条件を維持)。playground のパスモードに限り `../src/growth/` の深い import を暫定許可(ファイル先頭コメントに「3a 暫定・0.3.0 で公開面へ」と明示)。package.json の exports("." のみ)により npm 利用者から深い import は不可 = internal が保たれる。
- 描画の入口: growth モジュール内部の `renderGrowthPath(path, seed?)` が PathHit を解決し、`composite.morphology` があれば専用ジオメトリ、なければ最終ステージの `createSnowCrystal` に委譲。`createSnowCrystal` 自体は不変。
- CHANGELOG はブランチ上の Unreleased に積み、マージ時に 0.3.0 節へ。

## 7. テスト計画(vitest)

1. regionId → RegionClass 対応表: ml66 の全 region を網羅(過不足でテスト失敗)。
2. classifyGrowthPath ゴールデン: 柱クラス点 → 板クラス点で CP1a / 逆向きで CP3 系 / branched → plate で P2 系 / 同クラスで null。具体点は実装時に classifyOnDiagram で確定し、region id まで固定(P1d 微修正と同方式)。
3. パス長: length ≠ 2 は明示エラー(MVP)。
4. createCappedColumn: 部品 3・userData.part・R_p > R_c・キャップ中心 = 柱両端・c 軸共有・dispose 正常・同一入力 → 同一形状。
5. 既存 40 件回帰(分岐後も全パス維持)。

## 8. 専門家確認の追加(9 月、既存 (1)–(5) に追加)

- (6) 冠柱の標準成長ストーリー(柱 −5°C 前後 → 板領域 −10〜−17°C)の妥当性。ML66 Fig. 2 上部の遷移矢印との整合。
- (7) 複合対応表の confidence — 特に CP1a を「柱 → 板」2 段パスへ割り当てる解釈(ML66 Table 1 は型の定義であり、成長順序の明文は §3.7 系のみ)。

## 9. 実装段階(次回以降、各 CP で停止 → チャット検収)

- CP-P3-0【Normal】: feature/phase3 ブランチ作成 + 本設計書を docs/ にコミット
- CP-P3-1【Extra】: growth モジュール(型・クラス対応表・複合対応表・classifyGrowthPath)+ テスト
- CP-P3-2【Extra】: createCappedColumn + テスト + 目視(① 柱クラス点 → ② 板クラス点)
- CP-P3-3【MAX】: playground 成長パスモード(描画・選択・束ねスライダー・情報パネル)— 単独セッション推奨
- CP-P3-4【Normal】: 統合検収・スクリーンショット・CHANGELOG(ブランチ)・引き継ぎ

## 10. 目視定番(パス。CP-P3-1 のゴールデンで確定済み)

- 冠柱 CP1a: ①(−7, 0.03)= 角柱 ml66/C1e → ②(−14, 0.08)= 厚角板 ml66/C1g
- 逆向き(CP3 表示確認): ①(−15, 0.20)= 広幅枝 ml66/P1c → ②(−6, 0.10)= 骸晶角柱 ml66/C1f
- P2 系: ①(−15, 0.25)= 樹枝状 ml66/P1e → ②(−14, 0.12)= 角板 ml66/P1a で P2a/P2c(逆向きで P2f/P2g)
- 同クラス: ①(−15, 0.25)= 樹枝状 ml66/P1e → ②(−13, 0.22)= 広幅枝 ml66/P1c → 複合 — / 樹枝状表示
- polycrystal を含むパス: ①(−23, 0.25)= 砲弾集合 ml66/C2a → ②(−14, 0.08)= 厚角板 ml66/C1g → 複合 —
