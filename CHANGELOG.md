# Changelog

All notable changes to **snowcrystal** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased — feature/phase3] — targeting 0.3.0

Branch-local section (design doc §6): folds into the 0.3.0 notes when this
branch is merged after the 0.2.0 release. The 0.2.0 section below stays frozen.

### Added (internal)
- `src/growth/` — growth-path (environmental-history) module, the phase 3a MVP
  of docs/phase3-growth-path-design.md: `GrowthStage` / `GrowthPath` 2-stage
  data model, `RegionClass` mapping covering all 17 ML66 regions
  (vitest-enforced), data-driven `COMPOSITE_TABLE` (6 rows: CP1a / CP1b /
  P2a/P2c / P2f/P2g / CP3 ×2), and `classifyGrowthPath(path)` → `PathHit`.
- `createCappedColumn(seed?)` capped-column geometry (ML66 CP1a 冠柱, Table 1):
  hexagonal column + two end plates sharing the c axis; children in fixed
  order [column, top cap, bottom cap] with `userData.part: 'column' | 'cap'`
  and per-mesh materials.
- `renderGrowthPath(path, seed?)` dispatcher: the capped column for the CP1a
  geometric composite, otherwise delegates to `createSnowCrystal` with the
  final stage's morphology; stores its `PathHit` in `group.userData.pathHit`.
- **None of this is exported from `src/index.ts`** — with `exports` limited to
  `"."`, the growth module is invisible to npm consumers (dist byte-identical,
  MD5-verified per gate); promotion to the public surface is a 0.3.0 decision.
- `src/geometry/hexOutlineBuilder.ts` (case B, CP-B2): turn-constrained
  {10-10} outline builder — integer direction indices (no angular drift),
  an alternation rule that makes non-60°-family edges and interior angles
  other than 120°/240° unrepresentable by construction, and seam-turn /
  winding / closure checks in `close()`; plus `dentedHexOutline(R, m, w)`,
  the flower cross-section (mid-edge 60°-family notches) shared by the
  case-B morphologies. THREE conversion stays in parts.ts via the new
  shared `outlineToShape` / `extrudePrism` helpers (existing prism
  builders refactored onto them, behavior unchanged). Like the growth
  module, none of this is exported from `src/index.ts`.

### Added (playground)
- Growth-path mode as a third input mode (sliders / manual / growth path):
  click the condition diagram to place stage ① (open ○) then ② (filled ●),
  joined by a ①→② gradient arrow; both points are drag-movable, and clicking
  a point selects the stage the two existing sliders are bound to (no new
  sliders added).
- Stage colors ① #5DCAA5 / ② #85B7EB on the diagram points/arrow and on the
  capped column (column = ① / caps = ② via `userData.part`). Delegated
  renders stay uncolored — adopted: stage colors are reserved for part-level
  growth attribution, and the only geometric composite in 3a is the capped
  column.
- Info panel: stage ①/② rows (morphology / region) plus a composite row in
  three forms — geometric with the source field shown in full (「複合型:
  冠柱 (CP1a) — ML66 Table 1 + 標準解釈(柱→板)」, adopted over the abbreviated
  form), classification-only (「専用描画なし — 最終条件の形態で表示」), or
  「複合型: —」. Growth imports are deep imports from `src/growth/`,
  header-commented as 3a-temporary (public surface in 0.3.0).

### Changed
- **BREAKING (planned for 0.3.0)**: the `Morphology` union expanded with
  '星状' (stellar crystal), '羊歯' (fernlike crystal), and '長柱' (long solid
  column) — consumer code with exhaustive switches over `Morphology` must be
  updated (same shape as the 0.2.0 '砲弾集合' / '側面' expansion).

### Added
- Dedicated geometries for the three ML66 regions previously rendered by
  approximation (case M, 760ddeb): the P1d stellar region (was dendrite),
  the P1f fernlike region (was dendrite), and the N1e long-column region
  (was column) are reassigned to the new morphologies with fidelity
  approx → exact. Stellar and fernlike are a dendrite-arm parameter
  family — `DENDRITE_ARM_DEFAULTS` pins the current dendrite values
  (stellar = no side branches; fernlike = 5 dense, longer side pairs) —
  and the long column is a column dimension family (R 0.25 / H 2.0,
  aspect 4.0 vs the column's 1.875). All 11 pre-existing morphologies
  are bit-identical: full-mesh MD5 signatures (vertices + indices +
  world matrices, 11 morphologies × 2 seeds) match before/after, also
  reproduced cross-machine on Linux. Their global-classification codes
  stay unassigned pending expert item (4).

### Fixed
- Skeletal column (骸晶角柱), sheath (さや), and needle (針) rebuilt on
  {10-10}-consistent dented-hex ("flower") cross-section extrusions,
  closing self-audit #4 (c40ec0a): the BoxGeometry skeletons / edge bars
  (0.55 edge length > 0.4 hex side, interpenetrating at the corners) are
  removed from all three morphologies.
  - Skeletal column: flower section R 0.4 / m 0.16 / w 0.08 with full
    EdgesGeometry; column ends are now real hollows — a core column with
    highlight-colored cap floors plus two lip rings (hex hole r 0.28,
    vertices toward the corners). v1's apparent end dimple was an
    illusion cast by the +0.2 box-crown overhang (its sunken hex meshes
    were buried inside closed caps, never visible).
  - Sheath / needle center column: thin-walled flower section m 0.10 /
    w 0.05 (m + w preserves the v1 0.15 edge-box pitch); the five
    translucent inner layers are kept; capped end faces adopted (they
    display the dented cross-section from above).
  - Needle orientation made explicit: `rotation.y = −φ_i + Θ0`, Θ0 = π/6
    machine-verified from the CylinderGeometry vertex phase — ≡ 0
    (mod 60°), so the 12 needles stay bit-identical to v1 (pinned by
    test).
  - The public API is untouched — d.ts MD5 unchanged across CP-B2/B3
    (machine-checked); the rendered Group composition of the three
    morphologies changed (Boxes removed), which is why this lands as a
    0.3.0 Fixed entry.

## [Unreleased] — targeting 0.2.0

### Changed
- **Default classification switched** from the v1 Nakaya thresholds to a dataset
  digitized from Magono & Lee (1966) Fig. 2 (`ML66`), via a new declarative
  condition-diagram module (`classifyOnDiagram`, schema types, Murphy & Koop 2005
  saturation curve; internal relative-saturation axis s = ρ/ρ_ws(T) with s=1 at
  water saturation). The v1 behavior remains available explicitly as
  `classifyOnDiagram(t, v, NAKAYA_V1)`.
- ML66 dataset refinement (user-verified Fig.2 sketch IDs, 2026-06-10): the P1d
  stellar region in the (−17, −13] band now sits just above water saturation
  (sTop 1.0 → 1.12), and a new P1c broad-branch region (rendered as 扇形,
  approx) is inserted below it; the P1e dendrite region and the v1 showcase
  condition (−15°C, ρ=0.25) are unchanged.
- **BREAKING (planned for 0.2.0)**: the `Morphology` union expanded with
  '砲弾集合' and '側面' — consumer code with exhaustive switches over
  `Morphology` must be updated.

### Added
- `waterSaturationExcessDensity(tempC)` is now exported — the ρ_ws(T) water-vs-ice
  saturation vapor-density difference curve (Murphy & Koop 2005), so consumers
  (and the playground) can draw the water-saturation line (s = 1) of the
  condition diagram.
- New morphology **砲弾集合** (combination of bullets, ML66 C2a): 3–6 seeded
  radial bullet arms — hexagonal columns ending in {10-1̄1} pyramidal tips
  (62° to basal) — meeting at the center with mutual angles ≥ 50°.
  Deterministic per `seed`.
- New morphology **側面** (side planes, ML66 S1; S2 rendered approximately by
  the same geometry): 4–7 thin half-hex fins fanned around a shared a-axis
  spine, dihedral offsets anchored to the CSL twin angle 70.3° (±6° jitter)
  with per-fin size jitter ±20% and spine stagger. Deterministic per `seed`.
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
