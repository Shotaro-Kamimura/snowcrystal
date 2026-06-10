import type { ConditionDiagram, DiagramRegion } from './types';

// Magono & Lee (1966) Fig.2 のデジタイズ・データセット(設計書 §5 確定表)。
// vaporCoord は 's'(相対飽和: s = vapor / ρ_ws(T)、s=1 が水飽和)。
// 温度境界と縦順序は Fig.2 デジタイズ(2026-06-10、スケッチ同定はユーザー目視確認済み)、
// s の具体値は provisional(設計書 §5 の source/confidence 注記を参照)。
// 側面(S1/S2)の縦位置は ML66 原典忠実(水飽和の上)。MKY71 は下方修正を報告して
// おり、どちらに従うかは専門家確認事項(設計書 §13(5))。

const REGIONS: Readonly<Record<string, DiagramRegion>> = {
  // (−4, 0] は Fig.2 に図示がなく Kobayashi 1961 による補外(confidence low)
  'ml66/P1a-warm': {
    id: 'ml66/P1a-warm',
    mlCode: 'P1a',
    morphology: '角板',
    fidelity: 'exact',
    labelJa: '角板',
    source: 'Kobayashi 1961(補外)',
    confidence: 'low',
  },
  'ml66/P1a': {
    id: 'ml66/P1a',
    mlCode: 'P1a',
    morphology: '角板',
    fidelity: 'exact',
    labelJa: '角板',
    source: 'ML66 Fig.2(デジタイズ済)',
    confidence: 'mid',
  },
  'ml66/C1e': {
    id: 'ml66/C1e',
    mlCode: 'C1e',
    morphology: '角柱',
    fidelity: 'exact',
    labelJa: '角柱',
    source: 'ML66 Fig.2(デジタイズ済)',
    confidence: 'mid',
  },
  'ml66/C1f': {
    id: 'ml66/C1f',
    mlCode: 'C1f',
    morphology: '骸晶角柱',
    fidelity: 'exact',
    labelJa: '骸晶角柱',
    source: 'ML66 Fig.2(デジタイズ済・緑スケッチ)',
    confidence: 'mid',
  },
  'ml66/N1a': {
    id: 'ml66/N1a',
    mlCode: 'N1a',
    morphology: '針',
    fidelity: 'exact',
    labelJa: '針',
    source: 'ML66 §3.1',
    confidence: 'high',
  },
  'ml66/N1c': {
    id: 'ml66/N1c',
    mlCode: 'N1c',
    morphology: 'さや',
    fidelity: 'exact',
    labelJa: 'さや',
    source: 'ML66 §3.1',
    confidence: 'high',
  },
  'ml66/C1g': {
    id: 'ml66/C1g',
    mlCode: 'C1g',
    morphology: '厚角板',
    fidelity: 'exact',
    labelJa: '厚角板',
    source: 'ML66 Fig.2(デジタイズ済)',
    confidence: 'mid',
  },
  'ml66/P1b': {
    id: 'ml66/P1b',
    mlCode: 'P1b',
    morphology: '扇形',
    fidelity: 'exact',
    labelJa: '扇形',
    source: 'ML66 Fig.2(デジタイズ済)',
    confidence: 'mid',
  },
  'ml66/C1h': {
    id: 'ml66/C1h',
    mlCode: 'C1h',
    morphology: '骸晶角板',
    fidelity: 'exact',
    labelJa: '骸晶角板',
    source: 'ML66 Fig.2(デジタイズ済・紫スケッチ)',
    confidence: 'mid',
  },
  'ml66/P1c': {
    id: 'ml66/P1c',
    mlCode: 'P1c',
    morphology: '扇形',
    fidelity: 'approx',
    labelJa: '広幅枝',
    source: 'ML66 Fig.2(デジタイズ・ユーザー同定 2026-06-10)',
    confidence: 'mid',
  },
  'ml66/P1d': {
    id: 'ml66/P1d',
    mlCode: 'P1d',
    morphology: '樹枝状',
    fidelity: 'approx',
    labelJa: '星状',
    source:
      'ML66 Fig.2(デジタイズ済・赤スケッチ)。水飽和直上への移動はユーザーのスケッチ同定(赤枠=P1d)による 2026-06-10 修正',
    confidence: 'mid',
  },
  'ml66/P1e': {
    id: 'ml66/P1e',
    mlCode: 'P1e',
    morphology: '樹枝状',
    fidelity: 'exact',
    labelJa: '樹枝状',
    source: 'ML66 Fig.2(デジタイズ済)',
    confidence: 'high',
  },
  'ml66/P1f': {
    id: 'ml66/P1f',
    mlCode: 'P1f',
    morphology: '樹枝状',
    fidelity: 'approx',
    labelJa: '羊歯',
    source: 'provisional',
    confidence: 'low',
  },
  'ml66/C2a': {
    id: 'ml66/C2a',
    mlCode: 'C2a',
    morphology: '砲弾集合',
    fidelity: 'exact',
    labelJa: '砲弾集合',
    source: 'ML66 Fig.2(デジタイズ済・青スケッチ)',
    confidence: 'mid',
  },
  'ml66/S1': {
    id: 'ml66/S1',
    mlCode: 'S1',
    morphology: '側面',
    fidelity: 'exact',
    labelJa: '側面',
    source: 'ML66 Fig.2(デジタイズ済)',
    confidence: 'mid',
  },
  'ml66/S2': {
    id: 'ml66/S2',
    mlCode: 'S2',
    morphology: '側面',
    fidelity: 'approx',
    labelJa: '側面',
    source: 'ML66 Fig.2(デジタイズ済)・温度範囲は F8(Weickmann)',
    confidence: 'mid',
  },
  'ml66/N1e': {
    id: 'ml66/N1e',
    mlCode: 'N1e',
    morphology: '角柱',
    fidelity: 'approx',
    labelJa: '長柱',
    source: 'ML66 §3.1(Shimizu)',
    confidence: 'mid',
  },
};

export const ML66: ConditionDiagram = {
  id: 'ml66',
  vaporCoord: 's',
  tDomain: [-40, 0],
  rhoDomain: [0, 0.3],
  regions: REGIONS,
  bands: [
    { tMax: 0, tMin: -4, stack: [{ regionId: 'ml66/P1a-warm' }] },
    {
      tMax: -4,
      tMin: -6,
      stack: [
        { regionId: 'ml66/C1e', sTop: [0.45, 0.45] },
        { regionId: 'ml66/C1f', sTop: [0.9, 0.9] },
        { regionId: 'ml66/N1a' },
      ],
    },
    {
      tMax: -6,
      tMin: -8,
      stack: [
        { regionId: 'ml66/C1e', sTop: [0.45, 0.45] },
        { regionId: 'ml66/C1f', sTop: [0.9, 0.9] },
        { regionId: 'ml66/N1c' },
      ],
    },
    {
      tMax: -8,
      tMin: -10,
      stack: [{ regionId: 'ml66/C1e', sTop: [0.5, 0.5] }, { regionId: 'ml66/C1f' }],
    },
    {
      tMax: -10,
      tMin: -13,
      stack: [
        { regionId: 'ml66/C1e', sTop: [0.3, 0.3] },
        { regionId: 'ml66/C1g', sTop: [0.5, 0.5] },
        { regionId: 'ml66/P1a', sTop: [0.75, 0.75] },
        { regionId: 'ml66/P1b', sTop: [1.0, 1.0] },
        { regionId: 'ml66/C1h' },
      ],
    },
    {
      tMax: -13,
      tMin: -17,
      stack: [
        { regionId: 'ml66/C1e', sTop: [0.3, 0.3] },
        { regionId: 'ml66/C1g', sTop: [0.5, 0.5] },
        { regionId: 'ml66/P1a', sTop: [0.7, 0.7] },
        { regionId: 'ml66/P1b', sTop: [0.85, 0.85] },
        { regionId: 'ml66/P1c', sTop: [1.0, 1.0] },
        { regionId: 'ml66/P1d', sTop: [1.12, 1.12] },
        { regionId: 'ml66/P1e', sTop: [1.35, 1.35] },
        { regionId: 'ml66/P1f' },
      ],
    },
    {
      tMax: -17,
      tMin: -20,
      stack: [
        { regionId: 'ml66/C1e', sTop: [0.3, 0.3] },
        { regionId: 'ml66/C1g', sTop: [0.5, 0.5] },
        { regionId: 'ml66/P1a', sTop: [0.75, 0.75] },
        { regionId: 'ml66/P1b', sTop: [1.0, 1.0] },
        { regionId: 'ml66/C1h' },
      ],
    },
    {
      // 対角線(中実/中空境界): (−20, s0.15) → (−25, s0.575) → (−30, s1.0)
      tMax: -20,
      tMin: -25,
      stack: [
        { regionId: 'ml66/C1e', sTop: [0.15, 0.575] },
        { regionId: 'ml66/C1f', sTop: [1.0, 1.0] },
        { regionId: 'ml66/C2a', sTop: [1.5, 1.5] },
        { regionId: 'ml66/S1' },
      ],
    },
    {
      // C1f(中空柱)層は −30 端で対角線が水飽和に収束し零厚になる
      tMax: -25,
      tMin: -30,
      stack: [
        { regionId: 'ml66/C1e', sTop: [0.575, 1.0] },
        { regionId: 'ml66/C1f', sTop: [1.0, 1.0] },
        { regionId: 'ml66/C2a', sTop: [1.5, 1.5] },
        { regionId: 'ml66/S2' },
      ],
    },
    {
      tMax: -30,
      tMin: -35,
      stack: [
        { regionId: 'ml66/N1e', sTop: [1.0, 1.0] },
        { regionId: 'ml66/C2a', sTop: [1.5, 1.5] },
        { regionId: 'ml66/S2' },
      ],
    },
    {
      tMax: -35,
      tMin: -40,
      stack: [{ regionId: 'ml66/N1e', sTop: [1.0, 1.0] }, { regionId: 'ml66/C2a' }],
    },
  ],
};
