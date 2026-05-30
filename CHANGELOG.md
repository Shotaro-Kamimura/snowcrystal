# Changelog

All notable changes to **snowcrystal** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased (initial public release)

First public release.

### Added
- `createSnowCrystal(params)` returning a `THREE.Group` for nine snow-crystal
  morphologies (角板 / 角柱 / 針 / さや / 骸晶角柱 / 厚角板 / 骸晶角板 / 扇形 / 樹枝状),
  ported from the snownotes.org 3D snow-crystal viewer.
- Morphology selection by `temperature` / `supersaturation` (Nakaya diagram) via
  `getCrystalType`, or directly by `morphology`.
- `disposeCrystal(group)` to release GPU resources.
- `getCrystalType` and `getGlobalLabel` classification helpers, plus
  `Morphology` / `CrystalParams` types.
- Deterministic geometry: `Math.random` replaced with a seeded PRNG (mulberry32);
  same params produce the same shape.
- ESM-only, tree-shakeable (`"sideEffects": false`); `three` is a peer dependency.

### Notes
- This is a **morphological visualization, not a physical growth model**.
  See the README for sources (雪氷 88巻3号 / SEPPYO Vol.88 No.3).

[0.1.0]: https://github.com/Shotaro-Kamimura/snowcrystal/releases/tag/v0.1.0
