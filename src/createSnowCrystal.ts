import { THREE } from './three';
import type { CrystalParams, Morphology } from './types';
import { getCrystalType } from './classify';
import { mulberry32 } from './random';
import { buildMorphology } from './geometry/morphologies';

/** Fixed default seed so that, with no `seed` given, output is still deterministic. */
const DEFAULT_SEED = 1;

/** Default morphology when neither `morphology` nor a temperature/vapor pair is provided. */
const DEFAULT_MORPHOLOGY: Morphology = '樹枝状';

/**
 * Build a snow-crystal as a `THREE.Group`. Pure: touches no scene and no DOM.
 *
 * Selection order:
 *  1. `params.morphology` if given.
 *  2. otherwise `getCrystalType(temperature, supersaturation)` if both are given.
 *  3. otherwise the default morphology ('樹枝状').
 */
export function createSnowCrystal(params: CrystalParams = {}): THREE.Group {
  let morphology = params.morphology;

  if (
    morphology === undefined &&
    params.temperature !== undefined &&
    params.supersaturation !== undefined
  ) {
    morphology = getCrystalType(params.temperature, params.supersaturation);
  }

  if (morphology === undefined) {
    morphology = DEFAULT_MORPHOLOGY;
  }

  const rng = mulberry32(params.seed ?? DEFAULT_SEED);
  return buildMorphology(morphology, rng);
}

/**
 * Dispose all geometries and materials under a crystal group so its GPU
 * resources are released. Call after removing the group from the scene.
 */
export function disposeCrystal(group: THREE.Group): void {
  group.traverse((obj) => {
    const withGeo = obj as THREE.Mesh | THREE.LineSegments;
    if (withGeo.geometry) {
      withGeo.geometry.dispose();
    }
    const material = (withGeo as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(material)) {
      for (const m of material) m.dispose();
    } else if (material) {
      material.dispose();
    }
  });
}
