import { THREE } from '../three';
import { COLORS } from '../classify';

// Pure geometry helpers ported verbatim from snownotes main-fixed.js.
// They depend only on THREE and return Mesh/Group — no scene, no DOM.

export function createFanShape(
  centerRadius: number,
  centerHeight: number,
  armLength: number,
  armWidth: number,
  colorHex: number,
): THREE.Group {
  const group = new THREE.Group();

  const centerGeo = new THREE.CylinderGeometry(centerRadius, centerRadius, centerHeight, 6);
  const centerMat = new THREE.MeshStandardMaterial({ color: colorHex });
  // centerMesh は元実装でも group に追加されない（忠実移植）
  new THREE.Mesh(centerGeo, centerMat);

  // 角部に抜けを作るための補助メッシュ
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const x = (centerRadius + armLength / 2) * Math.cos(angle);
    const z = (centerRadius + armLength / 2) * Math.sin(angle);
    const geo = new THREE.BoxGeometry(armLength, centerHeight * 0.8, armWidth);
    const mesh = new THREE.Mesh(geo, centerMat);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = -angle;
    group.add(mesh);
  }
  return group;
}

export function createDiamondPrism(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();

  const topHeight = 1.5; // 上側三角の高さ
  const bottomHeight = 0.4; // 下側三角の高さ
  const width = 0.8; // 底辺の長さ
  const depth = 0.1; // 奥行き

  const vertices = new Float32Array([
    -width / 2, 0, depth / 2,
    width / 2, 0, depth / 2,
    0, topHeight, depth / 2,

    -width / 2, 0, depth / 2,
    width / 2, 0, depth / 2,
    0, -bottomHeight, depth / 2,

    -width / 2, 0, -depth / 2,
    width / 2, 0, -depth / 2,
    0, topHeight, -depth / 2,

    -width / 2, 0, -depth / 2,
    width / 2, 0, -depth / 2,
    0, -bottomHeight, -depth / 2,
  ]);

  const indices = [
    0, 1, 2,
    8, 7, 6,
    0, 2, 8, 8, 6, 0,
    2, 1, 7, 7, 8, 2,
    0, 6, 7, 7, 1, 0,

    3, 5, 4,
    11, 9, 10,
    3, 9, 11, 11, 5, 3,
    5, 11, 10, 10, 4, 5,
    3, 4, 10, 10, 9, 3,
  ];

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ color: COLORS.wing, flatShading: true });
  return new THREE.Mesh(geometry, material);
}

export function createSmallDiamondPrism(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();

  const topHeight = 0.4;
  const bottomHeight = 0.2;
  const width = 0.4;
  const depth = 0.08;

  const vertices = new Float32Array([
    -width / 2, 0, depth / 2,
    width / 2, 0, depth / 2,
    0, topHeight, depth / 2,

    -width / 2, 0, depth / 2,
    width / 2, 0, depth / 2,
    0, -bottomHeight, depth / 2,

    -width / 2, 0, -depth / 2,
    width / 2, 0, -depth / 2,
    0, topHeight, -depth / 2,

    -width / 2, 0, -depth / 2,
    width / 2, 0, -depth / 2,
    0, -bottomHeight, -depth / 2,
  ]);

  const indices = [
    0, 1, 2, 8, 7, 6,
    0, 2, 8, 8, 6, 0,
    2, 1, 7, 7, 8, 2,
    0, 6, 7, 7, 1, 0,

    3, 5, 4, 11, 9, 10,
    3, 9, 11, 11, 5, 3,
    5, 11, 10, 10, 4, 5,
    3, 4, 10, 10, 9, 3,
  ];

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ color: COLORS.wing });
  return new THREE.Mesh(geometry, material);
}

export function createMiniDiamondPrism(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();

  const topHeight = 0.4;
  const bottomHeight = 0.2;
  const width = 0.3;
  const depth = 0.05;

  const vertices = new Float32Array([
    -width / 2, 0, depth / 2,
    width / 2, 0, depth / 2,
    0, topHeight, depth / 2,

    -width / 2, 0, depth / 2,
    width / 2, 0, depth / 2,
    0, -bottomHeight, depth / 2,

    -width / 2, 0, -depth / 2,
    width / 2, 0, -depth / 2,
    0, topHeight, -depth / 2,

    -width / 2, 0, -depth / 2,
    width / 2, 0, -depth / 2,
    0, -bottomHeight, -depth / 2,
  ]);

  const indices = [
    0, 1, 2, 8, 7, 6,
    0, 2, 8, 8, 6, 0,
    2, 1, 7, 7, 8, 2,
    0, 6, 7, 7, 1, 0,

    3, 5, 4, 11, 9, 10,
    3, 9, 11, 11, 5, 3,
    5, 11, 10, 10, 4, 5,
    3, 4, 10, 10, 9, 3,
  ];

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ color: COLORS.wing, flatShading: true });
  return new THREE.Mesh(geometry, material);
}

export function createRedTriangularPrism(): THREE.Mesh {
  const radius = 0.5; // 三角形の外接円半径
  const height = 1.0; // 厚み（Y方向）

  const geometry = new THREE.CylinderGeometry(radius, radius, height, 3);
  geometry.rotateX(Math.PI / 2); // 上向きに回転
  geometry.translate(0, 0, 0); // 中央位置合わせ

  const material = new THREE.MeshStandardMaterial({
    color: 0xaa3333,
    flatShading: true,
  });

  return new THREE.Mesh(geometry, material);
}

export function createBranchWithChildren(angleRad: number): THREE.Group {
  const group = new THREE.Group();

  // 主枝（Z方向に2.0伸びる棒）
  const mainBranch = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 2.0),
    new THREE.MeshStandardMaterial({ color: COLORS.wing }),
  );
  mainBranch.position.z = 1.0; // 半分ずらして中心から放射状に

  group.add(mainBranch);

  // 副枝の数と間隔
  const sideCount = 3;
  const spacing = 0.5;
  const offsetX = 0.3;

  for (let i = 0; i < sideCount; i++) {
    const offsetZ = spacing * (i + 1.5);

    // 左右の副枝
    const petalL = createMiniDiamondPrism();
    const petalR = createMiniDiamondPrism();

    // 主枝にピタッと接するようにXZ平面上に寝かせ、鋭角を内向きに
    petalL.rotation.x = Math.PI / 2;
    petalL.rotation.z = Math.PI / 4 + Math.PI; // = 5π/4
    petalL.position.set(-offsetX, 0, offsetZ);

    petalR.rotation.x = Math.PI / 2;
    petalR.rotation.z = -Math.PI / 4 + Math.PI; // = 3π/4
    petalR.position.set(offsetX, 0, offsetZ);

    group.add(petalL, petalR);
  }

  // 🔁 全体を角度分だけ回転（groupごと回す！）
  group.rotation.y = -angleRad;

  return group;
}

export function createMainBranch(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(2.0, 0.05, 0.1); // 薄くて長い板
  const material = new THREE.MeshStandardMaterial({ color: 0x662222 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.x = 1.0; // 中心から伸ばす
  return mesh;
}

export function createSubBranch(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();

  const topHeight = 0.4;
  const bottomHeight = 0.2;
  const width = 0.3;
  const depth = 0.05;

  const vertices = new Float32Array([
    -width / 2, 0, depth / 2,
    width / 2, 0, depth / 2,
    0, topHeight, depth / 2,

    -width / 2, 0, depth / 2,
    width / 2, 0, depth / 2,
    0, -bottomHeight, depth / 2,

    -width / 2, 0, -depth / 2,
    width / 2, 0, -depth / 2,
    0, topHeight, -depth / 2,

    -width / 2, 0, -depth / 2,
    width / 2, 0, -depth / 2,
    0, -bottomHeight, -depth / 2,
  ]);

  const indices = [
    0, 1, 2, 8, 7, 6,
    0, 2, 8, 8, 6, 0,
    2, 1, 7, 7, 8, 2,
    0, 6, 7, 7, 1, 0,

    3, 5, 4, 11, 9, 10,
    3, 9, 11, 11, 5, 3,
    5, 11, 10, 10, 4, 5,
    3, 4, 10, 10, 9, 3,
  ];

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ color: 0x662222, flatShading: true });
  const mesh = new THREE.Mesh(geometry, material);

  // 🔄 向きをXZ平面と並行に寝かせる（六角柱と同じ）
  mesh.rotation.x = Math.PI / 2;

  return mesh;
}

export function createMainBlade(length = 2.0, width = 0.2, thickness = 0.05): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(width, length);
  shape.lineTo(-width, length);
  shape.lineTo(0, 0); // 閉じる

  const extrudeSettings = {
    depth: thickness,
    bevelEnabled: false,
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.rotateX(Math.PI / 2); // 横倒しに
  geometry.translate(0, 0, -thickness / 2); // 中央揃え

  const material = new THREE.MeshStandardMaterial({ color: 0x662222, flatShading: true });
  return new THREE.Mesh(geometry, material);
}

export function createFanHexGeometryFilled(
  radius = 1,
  height = 0.2,
  dentDepth = 0.3,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const dentRatio = 0.35;

  for (let i = 0; i < 6; i++) {
    const a0 = (Math.PI / 3) * i;
    const a1 = (Math.PI / 3) * (i + dentRatio);
    const a2 = (Math.PI / 3) * (i + 0.5);
    const a3 = (Math.PI / 3) * (i + 1 - dentRatio);
    const a4 = (Math.PI / 3) * (i + 1);

    if (i === 0) {
      shape.moveTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
    }

    shape.lineTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
    shape.lineTo(Math.cos(a2) * (radius - dentDepth), Math.sin(a2) * (radius - dentDepth));
    shape.lineTo(Math.cos(a3) * radius, Math.sin(a3) * radius);
    shape.lineTo(Math.cos(a4) * radius, Math.sin(a4) * radius);
  }

  const extrudeSettings = {
    depth: height,
    bevelEnabled: false,
    material: 1, // 側面
    extrudeMaterial: 0, // 上下の面
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, -height / 2);
  return geometry;
}

export function createHexRingFrame(
  radius: number,
  thickness: number,
  height: number,
): THREE.Group {
  const group = new THREE.Group();
  const edgeLength = radius; // 見た目調整に応じて調整可

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);

    const boxGeo = new THREE.BoxGeometry(edgeLength, height, thickness);
    const boxMat = new THREE.MeshStandardMaterial({ color: COLORS.edge });
    const box = new THREE.Mesh(boxGeo, boxMat);

    box.position.set(x, 0, z);
    box.rotation.y = -angle;

    group.add(box);
  }

  return group;
}
