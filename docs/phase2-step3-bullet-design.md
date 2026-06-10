# Phase 2 ステップ3 設計書: 砲弾(C1c/C1d)と砲弾集合(C2a)の幾何

snowcrystal v2 / ステップ3 チェックポイント1 成果物。**コード変更なし・設計のみ**。
状態: ドラフト(検収待ち)/ 2026-06-10 / 親文書: docs/phase2-ml66-diagram-design.md §6.3

## 0. スコープと前提

- 対象: 砲弾(部品。図上の独立領域なし)と砲弾集合(C2a。ml66 の領域形態)。側面(S1/S2)は次の設計チェックポイントで別途。
- 前提(確定済み): C1c(中実)/C1d(中空)は単一「砲弾」部品に統合、空洞は将来パラメータ。Fig.1 のスケッチ(C1c/C1d/C2a)を形態参照とする。

## 1. 結晶学: 錐状終端の角度導出

砲弾の尖った側は、氷の標準的な錐面 **{10-1̄1}** の6面で閉じる。角度は格子定数から導出する:

- 氷 Ih の格子定数: a = 4.518 Å, c = 7.356 Å(Petrenko & Whitworth, Physics of Ice, 1999)→ **c/a = 1.628**
- {10-1̄1} 面の法線が c 軸となす角: tan θ = 2c/(√3·a) → **θ = 62.0°**
  (= 錐面と基底面 (0001) の二面角 62.0°、錐面と柱軸のなす角 **28.0°**)
- 六角錐がシャープに閉じる場合の高さ: 外接半径 R に対し
  **h = (c/a)·R ≈ 1.63 R**
  (導出: 錐面は柱面 {10-1̄0} の上端エッジから内傾 28.0°。アポセム R√3/2 を
  tan28.0° = √3a/(2c) で割ると h = R·c/a)

実装はこの 3 定数(C_OVER_A / 錐面角 / h(R) 関数)を `crystallography.ts` に置き、テストで生成ジオメトリから逆算検証する(§5)。同じ {10-1̄1} 定数は将来 C1a 角錐を追加する場合にも再利用できる。

## 2. 砲弾部品の幾何仕様

- 構成: 六角柱(基底=平坦な (0001) 面、自由端)+ 六角錐(錐端=ロゼット中心側)。
- 軸 = c 軸。錐の 6 面は柱の 6 面それぞれの上端エッジを底辺として共有し、稜は柱の頂点から頂点(apex)へ走る。
- 寸法パラメータ: `createBullet(R, bodyLength, opts)` — R = 外接半径、bodyLength = 柱部長。錐高は h = 1.628·R を内部で自動算出。既定アスペクトは柱部 ≈ 2.5R〜3R(Fig.1 スケッチの見た目に整合。最終値は実装時に既存「角柱」とのスケール比較で確定)。
- opts(将来拡張、今回は既定のみ): `tipTruncation = 0`(シャープ apex。>0 で錐先端を小さな基底面で切る)、`hollow = false`(C1d の基底側空洞。骸晶系と同じ意匠で将来実装)。
- THREE 構成: CylinderGeometry(R, R, L, 6, 1) + ConeGeometry(R, h, 6) の組(プロジェクト既存流儀。扇形が CylinderGeometry 6分割を使用済み)。両者の回転位相(thetaStart)を一致させ、リング頂点が共有されることをテストで保証。マテリアルは COLORS.wing 系・flatShading: true 統一。

## 3. 砲弾集合(ロゼット)の仕様

- 物理像: 凍結雲粒起源の多結晶。共通中心から複数の砲弾が**錐端を中心に向けて**放射する。
- 本数: シード乱数で **3〜6 本**(一様)。seed 既定は既存 random.ts(mulberry32)の流儀に従う — 針の長さに続く、seed の2例目の利用者になる(同一 params + seed → 同一形状の決定性は維持)。
- 方位分布: 単位球上のシード乱数方向 + **最小相互角制約 ≥ 50°**(棄却サンプリング、上限反復到達時は本数別の正準配置にフォールバック: 3=三脚 / 4=四面体 / 5=三方両錐 / 6=八面体)。各砲弾の軸まわりロール角もシード乱数。
- 中心部: 追加ジオメトリは置かず、各砲弾を中心方向へ δ = 0.05·R だけ埋め込んで apex 同士を干渉させる(隙間・Zファイトの回避。多結晶コアの明示モデル化はしない)。
- 本数・サイズの揺らぎ: 第一版は全砲弾同寸。腕ごとの長さ揺らぎ(±15% 程度)は opts で後送可。

## 4. コード配置と API

- `src/geometry/crystallography.ts`: ICE_C_OVER_A、PYRAMID_FACE_ANGLE(導出式と出典を JSDoc に明記)、hexPyramidApexHeight(R)。すべて THREE 非依存。
- `src/geometry/parts.ts`: createBullet(R, bodyLength, opts) / createBulletRosette(rng, opts)。
- `src/geometry/morphologies.ts`: '砲弾集合' 分岐の暫定フォールバック(→角柱)を createBulletRosette に差し替え。'側面' のフォールバックは次設計まで現状維持。
- 公開 API・Morphology 連合型の変更なし(ステップ2で追加済み)。

## 5. テスト計画(vitest、既存角度テストと同居)

1. 定数: ICE_C_OVER_A = 1.628 ± 0.001、PYRAMID_FACE_ANGLE = 28.0° ± 0.1°、h(1) = 1.628 ± 0.002。
2. 生成ジオメトリ逆算: createBullet の錐面 1 枚の法線と柱軸のなす角 = 62.0° ± 0.2°/柱断面の内角 120°(既存ヘルパー再利用)/柱リングと錐リングの頂点一致(位相整合)。
3. ロゼット: 同一 seed → 腕軸ベクトル列が完全一致(決定性)/全ペア相互角 ≥ 50°/本数が 3〜6 の範囲。
4. フォールバック差し替え後も createSnowCrystal({morphology:'砲弾集合'}) が THREE.Group を返し dispose 可能(スモーク)。

## 6. 実装チェックポイント分割(各 gate = typecheck/test/build/pack 7ファイル不変)

- CP3-2【Claude Code】: 結晶学定数 + createBullet + テスト §5-1,2 → コミット
  "feat(geometry): add bullet primitive with {10-11}-consistent pyramidal tip (62 deg to basal, apex height c/a*R)"
- CP3-3【Claude Code】: createBulletRosette + 方位サンプリング + '砲弾集合' 差し替え + テスト §5-3,4 → コミット
  "feat(geometry): implement bullet-rosette morphology with seeded radial arms, replacing interim column fallback"
  → 目視: −23°C / 0.25(s≈1.2)で砲弾集合を確認。
- その後: 側面(S1/S2)の設計チェックポイント(チャット側)→ CP3-4/5。

## 7. 検収論点(5件、Yes/No/修正で)

1. 錐端 = {10-1̄1} 6面、軸から 28.0°、シャープ apex(h = 1.628R)。truncation は既定 0 のパラメータ — 採否。
2. C1c/C1d 統合・空洞は将来パラメータ(ステップ2方針の追認) — 採否。
3. ロゼット: 本数 3〜6(シード乱数)+最小相互角 50°+正準配置フォールバック — 採否(本数レンジの変更希望があれば指定)。
4. 中心部はジオメトリ追加なし・apex を δ=0.05R 埋め込み — 採否(多結晶コアを足す案もあり)。
5. 寸法の最終値(R・柱部長・既存角柱とのスケール整合)は CP3-2 実装時に実測比較で確定し、diff 検収で判断 — 一任でよいか。
