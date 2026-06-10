# snowcrystal

Three.js geometry for snow-crystal **morphology**, ported from the
[snownotes.org 3D snow-crystal viewer](https://snownotes.org/).

`createSnowCrystal(params)` returns a `THREE.Group` you can drop into any scene.
Eleven morphologies are supported, selectable directly or derived from a
temperature / vapor pair on a growth-condition diagram — by default a dataset
digitized from Magono & Lee (1966) Fig. 2 (`ML66`); the previous v1 thresholds
remain available as `NAKAYA_V1`.

---

## ⚠️ これは形態の可視化です（物理モデルではありません）

本パッケージは、雪結晶の**成長を支配する物理法則や微視的な成長メカニズムを数理的に
再現するものではありません**。中谷ダイアグラムや Magono & Lee (1966) の成長条件図
（気温・水蒸気量と形態の対応）と、雪結晶の**グローバル分類（121種）**という既存の
観測図・文献を参照し、結晶の六角対称性・階層構造・形態的特徴といった**外形を
三次元的に可視化する試み**です。側面から見た内部構造や厚みは物理的に正確なモデルでは
ありません。

## ⚠️ This is a morphological visualization, not a physical model

This package does **not** numerically reproduce the physical laws or microscopic
growth mechanisms governing snow-crystal formation. It is a 3D visualization of
crystal **morphology** based on existing observational diagrams and literature —
the Nakaya diagram, the Magono & Lee (1966) growth-condition diagram, and the
Global Classification of snow crystals (121 types). It focuses on external
features such as hexagonal symmetry, hierarchical structure, and characteristic
crystal forms, and is not a physically accurate representation of internal
structure or thickness.

---

## Install

```sh
npm install snowcrystal three
```

`three` is a **peer dependency** — you provide it yourself (`>=0.150.0`).
The package ships ESM only and is tree-shakeable (`"sideEffects": false`).

## Usage

```ts
import * as THREE from 'three';
import { createSnowCrystal, disposeCrystal } from 'snowcrystal';

const scene = new THREE.Scene();

// 1) Pick a morphology directly (11 types):
const crystal = createSnowCrystal({ morphology: '樹枝状' });
scene.add(crystal);

// 2) Or derive it from temperature (°C, negative below freezing)
//    and the vapor axis (0–0.3), via the growth-condition diagram:
const fromClimate = createSnowCrystal({ temperature: -15, supersaturation: 0.25 });
scene.add(fromClimate);

// 3) Deterministic: the same params always produce the same shape.
//    `seed` controls the (otherwise fixed) pseudo-randomness used by some
//    forms (針 length, 砲弾集合 arms, 側面 fins).
const rosette = createSnowCrystal({ morphology: '砲弾集合', seed: 7 });

// Clean up GPU resources when you remove a crystal:
scene.remove(crystal);
disposeCrystal(crystal);
```

### Classification (condition diagram)

The (temperature, vapor) → morphology mapping is data-driven. The default
diagram `ML66` is digitized from Fig. 2 of Magono & Lee (1966); the v1 mapping
is kept as `NAKAYA_V1`.

```ts
import {
  classifyOnDiagram, ML66, NAKAYA_V1, waterSaturationExcessDensity,
} from 'snowcrystal';

const hit = classifyOnDiagram(-33, 0.05);  // default: ML66
hit.morphology;       // '角柱'  — what createSnowCrystal renders
hit.region.labelJa;   // '長柱'  — the diagram region it landed in
hit.region.mlCode;    // 'N1e'   — Magono–Lee code of that region

classifyOnDiagram(-15, 0.25, NAKAYA_V1);   // previous v1 behavior

// Water-saturation line (s = 1) of the diagram, in vapor-axis units:
waterSaturationExcessDensity(-15);         // ≈ 0.218 (Murphy & Koop 2005)
```

Diagram regions and rendered morphologies are two layers: several regions
(e.g. 長柱 N1e) currently map onto the same rendered morphology (角柱) until a
dedicated geometry exists. The vertical axis (0–0.3) is interpreted as excess
vapor density over ice (g/m³ scale), with the water-saturation curve anchored
by Murphy & Koop (2005).

### API

```ts
type Morphology =
  | '角板' | '角柱' | '針' | 'さや' | '骸晶角柱'
  | '厚角板' | '骸晶角板' | '扇形' | '樹枝状'
  | '砲弾集合' | '側面';

interface CrystalParams {
  morphology?: Morphology;   // primary key (11 types)
  temperature?: number;      // °C; with supersaturation, mapped via the diagram
  supersaturation?: number;  // vapor axis, 0–0.3
  seed?: number;             // fixes pseudo-randomness (deterministic by default)
}

function createSnowCrystal(params?: CrystalParams): THREE.Group;
function disposeCrystal(group: THREE.Group): void;

function getCrystalType(temp: number, vapor: number): Morphology;
function classifyOnDiagram(
  temp: number, vapor: number, diagram?: ConditionDiagram,
): RegionHit;
const ML66: ConditionDiagram;       // default — Magono & Lee (1966) Fig. 2
const NAKAYA_V1: ConditionDiagram;  // v1 thresholds, kept for compatibility
function waterSaturationExcessDensity(tempC: number): number; // ρ_ws(T)

function getGlobalLabel(morphology: Morphology): string;
// e.g. '樹枝状' → 'P4g'. For '砲弾集合' / '側面' the Global Classification
// code assignment is pending review and an empty string '' is returned.
```

If `morphology` is omitted but `temperature` and `supersaturation` are given,
the morphology is derived via the diagram. If nothing is given, it defaults to
`'樹枝状'`.

Notes for 0.1.x users:

- `Morphology` gained two members in 0.2.0 (`'砲弾集合'`, `'側面'`) — exhaustive
  `switch` statements over `Morphology` must be updated.
- `getCrystalType` now classifies on `ML66`; at some (temperature, vapor)
  points the result differs from 0.1.x. The v1 mapping remains available
  explicitly via `classifyOnDiagram(t, v, NAKAYA_V1)`.

## Playground

```sh
npm run dev
```

A minimal Three.js viewer with a morphology selector, `OrbitControls`, and the
growth-condition diagram rendered from the same `ML66` dataset (regions,
labels, and the water-saturation curve share a single source).

---

## Sources / 出典

- Nakaya, U. (1955): Snow Crystals and Aerosols. Journal of the Faculty of Science, Hokkaido University, Japan, Ser. II, 4(6), 341–354.
- Kobayashi, T. (1960): Experimental researches on the snow crystal habit and growth using a convection-mixing chamber. J. Meteorol. Soc. Japan, 38, 231–238.
- Magono, C. & Lee, C. W. (1966): Meteorological classification of natural snow crystals. Journal of the Faculty of Science, Hokkaido University, Ser. VII, 2(4), 321–335.
- Kobayashi, T., Furukawa, Y., Takahashi, T. & Uyeda, H. (1976): Cubic structure models at the junctions in polycrystalline snow crystals. Journal of Crystal Growth, 35, 262–268.
- Murphy, D. M. & Koop, T. (2005): Review of the vapour pressures of ice and supercooled water for atmospheric applications. Quarterly Journal of the Royal Meteorological Society, 131(608), 1539–1565. doi:10.1256/qj.04.94
- 菊地勝弘・亀田貴雄・樋口敬二・山下 晃・雪結晶の新しい分類表を作る会メンバー (2012): 中緯度と極域での観測に基づいた新しい雪結晶の分類 ─グローバル分類─. 雪氷, 74(3), 223–241.
- Kikuchi, K., Kameda, T., Higuchi, K. & Yamashita, A. (2013): A global classification of snow crystals, ice crystals, and solid precipitation based on observations from middle latitudes to polar regions. Atmospheric Research, 132, 460–472. doi:10.1016/j.atmosres.2013.06.006

## Related / 関連

This package ports the geometry from the SnowNotes "3D Visualization of Snow Crystals" web tool, which is introduced in:

- 上村祥太郎 (2026)「インタラクティブな可視化ツールを用いた『雪結晶 3D ビジュアル』の紹介」（談話室）雪氷, 88(3), 215–217. ISSN 0373-1006. https://snownotes.org/elsewhere/snow-crystal-3d-seppyo/
- Kamimura, S. (2026): Introduction to "3D Visualization of Snow Crystals," an interactive visualization tool (Note). Seppyo, 88(3), 215–217. ISSN 0373-1006. https://snownotes.org/en/elsewhere/snow-crystal-3d-seppyo/

## License

MIT © 2026 Shotaro Kamimura (SnowNotes)
