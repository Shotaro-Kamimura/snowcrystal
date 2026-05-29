# snowcrystal

Three.js geometry for snow-crystal **morphology**, ported from the
[snownotes.org 3D snow-crystal viewer](https://snownotes.org/).

`createSnowCrystal(params)` returns a `THREE.Group` you can drop into any scene.
Nine morphologies are supported, selectable directly or derived from a
temperature / supersaturation pair (Nakaya diagram).

---

## ⚠️ これは形態の可視化です（物理モデルではありません）

本パッケージは、雪結晶の**成長を支配する物理法則や微視的な成長メカニズムを数理的に
再現するものではありません**。中谷ダイアグラム（気温・過飽和度と形態の対応）と、雪結晶の
**グローバル分類（121種）**という既存の観測図・文献を参照し、結晶の六角対称性・階層構造・
形態的特徴といった**外形を三次元的に可視化する試み**です。側面から見た内部構造や厚みは
物理的に正確なモデルではありません。

## ⚠️ This is a morphological visualization, not a physical model

This package does **not** numerically reproduce the physical laws or microscopic
growth mechanisms governing snow-crystal formation. It is a 3D visualization of
crystal **morphology** based on existing observational diagrams and literature —
the Nakaya diagram and the Global Classification of snow crystals (121 types).
It focuses on external features such as hexagonal symmetry, hierarchical
structure, and characteristic crystal forms, and is not a physically accurate
representation of internal structure or thickness.

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

// 1) Pick a morphology directly (9 types):
const crystal = createSnowCrystal({ morphology: '樹枝状' });
scene.add(crystal);

// 2) Or derive it from temperature (°C, negative below freezing)
//    and supersaturation (vapor, 0–0.3), like the Nakaya diagram:
const fromClimate = createSnowCrystal({ temperature: -15, supersaturation: 0.25 });
scene.add(fromClimate);

// 3) Deterministic: the same params always produce the same shape.
//    `seed` controls the (otherwise fixed) pseudo-randomness used by some forms.
const seeded = createSnowCrystal({ morphology: '針', seed: 42 });

// Clean up GPU resources when you remove a crystal:
scene.remove(crystal);
disposeCrystal(crystal);
```

### API

```ts
type Morphology =
  | '角板' | '角柱' | '針' | 'さや' | '骸晶角柱'
  | '厚角板' | '骸晶角板' | '扇形' | '樹枝状';

interface CrystalParams {
  morphology?: Morphology;   // primary key (9 types)
  temperature?: number;      // °C; with supersaturation, mapped via getCrystalType
  supersaturation?: number;  // vapor, 0–0.3
  seed?: number;             // fixes pseudo-randomness (deterministic by default)
}

function createSnowCrystal(params?: CrystalParams): THREE.Group;
function disposeCrystal(group: THREE.Group): void;
function getCrystalType(temp: number, vapor: number): Morphology;
function getGlobalLabel(morphology: Morphology): string; // e.g. '樹枝状' -> 'P4g'
```

If `morphology` is omitted but `temperature` and `supersaturation` are given,
the morphology is derived via `getCrystalType`. If nothing is given, it defaults
to `'樹枝状'`.

## Playground

```sh
npm run dev
```

A minimal Three.js viewer with a morphology selector and `OrbitControls`.

---

## Sources / 出典

- 雪氷 88巻3号 ISSN 0373-1006 p215-217 —
  <https://snownotes.org/elsewhere/snow-crystal-3d-seppyo/>
- SEPPYO Vol.88, No.3 ISSN 0373-1006 p215-217 —
  <https://snownotes.org/en/elsewhere/snow-crystal-3d-seppyo/>
- グローバル分類（121種）/ Global Classification —
  <https://snownotes.org/snow-crystals/>
- 菊地勝弘・亀田貴雄・樋口敬二・山下晃ほか（2012）: 中緯度と極域での観測に基づいた
  新しい雪結晶の分類 ― グローバル分類 I. *雪氷*, **74**(3), 223–241.
- Kobayashi, T. (1960) Experimental researches on the snow crystal habit and
  growth using a convection-mixing chamber. *J. Meteorol. Soc. Japan*, **38**, 231–238.

## License

MIT © 2026 Shotaro Kamimura (SnowNotes)
