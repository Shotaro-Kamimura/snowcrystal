import { describe, it, expect } from 'vitest';
import { THREE } from '../three';
import {
  ICE_C_OVER_A,
  PYRAMID_FACE_ANGLE_FROM_AXIS_RAD,
  hexPyramidApexHeight,
} from './crystallography';
import { createBullet } from './parts';

const DEG = 180 / Math.PI;

type V3 = [number, number, number];

/**
 * geometry から y ≈ targetY の頂点を重複除去して取り出す（半径 minRadius 未満は除外）。
 * 抽出許容は 1e-5: THREE の position 属性は Float32Array のため座標精度は ~1e-7 相当で、
 * 1e-9 では一致判定できない（リング一致そのものの判定基準 1e-6 とは別物）。
 */
function ringVertices(geometry: THREE.BufferGeometry, targetY: number, minRadius: number): V3[] {
  const pos = geometry.getAttribute('position');
  const out: V3[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.abs(y - targetY) > 1e-5) continue;
    if (Math.hypot(x, z) < minRadius) continue;
    if (out.some(([ox, , oz]) => Math.hypot(ox - x, oz - z) < 1e-5)) continue;
    out.push([x, y, z]);
  }
  // 方位角順に整列
  return out.sort((p, q) => Math.atan2(p[2], p[0]) - Math.atan2(q[2], q[0]));
}

describe('結晶学定数（{10-1̄1} 錐面、設計書 §5-1）', () => {
  it('a. ICE_C_OVER_A = 1.628 ± 0.001', () => {
    expect(Math.abs(ICE_C_OVER_A - 1.628)).toBeLessThanOrEqual(0.001);
  });

  it('a. PYRAMID_FACE_ANGLE_FROM_AXIS_RAD = 28.0° ± 0.1°', () => {
    expect(Math.abs(PYRAMID_FACE_ANGLE_FROM_AXIS_RAD * DEG - 28.0)).toBeLessThanOrEqual(0.1);
  });

  it('a. hexPyramidApexHeight(1) = 1.628 ± 0.002', () => {
    expect(Math.abs(hexPyramidApexHeight(1) - 1.628)).toBeLessThanOrEqual(0.002);
  });
});

describe('createBullet 生成ジオメトリの逆算（設計書 §5-2）', () => {
  const R = 1;
  const L = 2.5;
  const h = hexPyramidApexHeight(R);
  const bullet = createBullet(R, L);
  const cone = (bullet.children[0] as THREE.Mesh).geometry as THREE.BufferGeometry;
  const body = (bullet.children[1] as THREE.Mesh).geometry as THREE.BufferGeometry;

  it('b. 錐側面1枚の面法線と +Y 軸のなす角 = 62.0° ± 0.2°', () => {
    const ring = ringVertices(cone, h, 0.5);
    expect(ring).toHaveLength(6);
    const apex = new THREE.Vector3(0, 0, 0);
    const v1 = new THREE.Vector3(...ring[0]);
    const v2 = new THREE.Vector3(...ring[1]);
    const normal = new THREE.Vector3()
      .crossVectors(v1.clone().sub(apex), v2.clone().sub(apex))
      .normalize();
    const angleDeg = Math.acos(Math.abs(normal.y)) * DEG;
    expect(Math.abs(angleDeg - 62.0), `実測 ${angleDeg.toFixed(3)}°`).toBeLessThanOrEqual(0.2);
  });

  it('b. 柱断面六角形の内角 = 120°', () => {
    const ring = ringVertices(body, h, 0.5);
    expect(ring).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      const prev = ring[(i + 5) % 6];
      const cur = ring[i];
      const next = ring[(i + 1) % 6];
      const u = [prev[0] - cur[0], prev[2] - cur[2]];
      const w = [next[0] - cur[0], next[2] - cur[2]];
      const dot = u[0] * w[0] + u[1] * w[1];
      const angle = Math.acos(dot / (Math.hypot(u[0], u[1]) * Math.hypot(w[0], w[1]))) * DEG;
      // 頂点座標が float32 のため、許容は 1e-4 度（座標誤差 ~1e-7 由来）
      expect(Math.abs(angle - 120)).toBeLessThan(1e-4);
    }
  });

  it('b. 錐底リングと柱下リングの対応頂点が位置一致（誤差 1e-6）', () => {
    const coneRing = ringVertices(cone, h, 0.5);
    const bodyRing = ringVertices(body, h, 0.5);
    expect(coneRing).toHaveLength(6);
    expect(bodyRing).toHaveLength(6);
    let maxGap = 0;
    for (const cv of coneRing) {
      const gap = Math.min(
        ...bodyRing.map((bv) => Math.hypot(cv[0] - bv[0], cv[1] - bv[1], cv[2] - bv[2])),
      );
      maxGap = Math.max(maxGap, gap);
    }
    expect(maxGap, `最大ギャップ ${maxGap}`).toBeLessThan(1e-6);
  });

  it('b. 柱の上端リングは y = h + bodyLength（軸方向の組み立て確認）', () => {
    const topRing = ringVertices(body, h + L, 0.5);
    expect(topRing).toHaveLength(6);
  });
});
