# Changelog

All notable changes to **snowcrystal** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Internal `crystallography` module (THREE-independent pure functions): `A_AXES`
  basal-plane a-axis basis and `elongatedHexOutline` ({10-10}-consistent elongated
  hexagon), with automated vitest checks for 120° interior angles, 60°-family edge
  orientations, and parallel-side spacing. Not yet part of the public API.

### Fixed
- Dendrite (樹枝状) side branches: opening angle corrected from ±45° to ±60°
  (90° → 120°) with tips now pointing outward, per {10-10} prism-face geometry.
- Dendrite side-branch shape: kite prisms (non-parallel sides) replaced with
  elongated hexagons — parallel sides, all interior angles 120°, base vertex
  flush on the main-branch face.
- Sector plate (扇形) petals: kite prisms replaced with elongated hexagons —
  outer tip angle 90° → 120°, parallel sides, base vertex inside the center
  column (zero gap); tip radius 1.52 keeps the v1 outline.
- Sector plate (扇形) petal phase: petals now emanate from the center-column
  vertices (a-axis ⟨11-20⟩ directions, +30°), matching the dendrite arms; they
  previously emanated from {10-10} face centers.

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
