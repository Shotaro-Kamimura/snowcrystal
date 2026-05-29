// Single entry point for the `three` peer dependency.
// Every other module imports THREE from here so the peerDep surface is in one place.
// (Use `import * as` + `export {}` rather than `export * as`, which api-extractor
//  rejects when rolling up declaration files.)
import * as THREE from 'three';

export { THREE };
