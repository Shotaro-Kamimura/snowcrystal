# Changelog

All notable changes to **snowcrystal** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — targeting 0.2.0

### Changed
- **Default classification switched** from the v1 Nakaya thresholds to a dataset
  digitized from Magono & Lee (1966) Fig. 2 (`ML66`), via a new declarative
  condition-diagram module (`classifyOnDiagram`, schema types, Murphy & Koop 2005
  saturation curve; internal relative-saturation axis s = ρ/ρ_ws(T) with s=1 at
  water saturation). The v1 behavior remains available explicitly as
  `classifyOnDiagram(t, v, NAKAYA_V1)`.
- **BREAKING (planned for 0.2.0)**: the `Morphology` union expanded with
  '砲弾集合' and '側面' — consumer code with exhaustive switches over
  `Morphology` must be updated.

### Added
- New morphologies **砲弾集合** (combination of bullets, ML66 C2a) and **側面**
  (side planes, ML66 S1/S2) — classification only for now; rendering falls back
  to the 角柱 / 厚角板 geometry until the dedicated geometry lands (Phase 2 step 3).
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
- Dendrite main branches are now elongated hexagonal prisms with 120-degree
  tip facets ({10-10} trace), replacing the rectangular boxes; branch material
  now uses flatShading, unifying shading across main and side branches.
  Main-branch tips (z=2.1) slightly lead the outermost side-branch tips (z=2.05).

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
