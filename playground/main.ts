import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createSnowCrystal, disposeCrystal, type Morphology } from '../src/index';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 0, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));

const morphologySelect = document.getElementById('morphology') as HTMLSelectElement;
const seedInput = document.getElementById('seed') as HTMLInputElement;

let current: THREE.Group | null = null;

function rebuild(): void {
  if (current) {
    scene.remove(current);
    disposeCrystal(current);
  }
  current = createSnowCrystal({
    morphology: morphologySelect.value as Morphology,
    seed: Number(seedInput.value) || 0,
  });
  scene.add(current);
}

morphologySelect.addEventListener('change', rebuild);
seedInput.addEventListener('input', rebuild);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate(): void {
  requestAnimationFrame(animate);
  if (current) current.rotation.y += 0.005;
  controls.update();
  renderer.render(scene, camera);
}

rebuild();
animate();
