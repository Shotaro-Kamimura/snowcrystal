import type { CompositeEntry } from './types';

/**
 * 複合対応表 v1(設計書 §3 の 5 論理エントリを (from, to) 単一ペアの 6 行に展開)。
 * data-driven: classifyGrowthPath はこの表を照合するだけで、該当なしは null。
 */
export const COMPOSITE_TABLE: readonly CompositeEntry[] = [
  {
    id: 'composite/CP1a',
    mlCode: 'CP1a',
    labelJa: '冠柱',
    from: 'needle-column',
    to: 'plate',
    morphology: '冠柱',
    fidelity: 'exact',
    source: 'ML66 Table 1 + 標準解釈(柱→板)',
    confidence: 'mid',
  },
  {
    id: 'composite/CP1b',
    mlCode: 'CP1b',
    labelJa: '樹枝付柱',
    from: 'needle-column',
    to: 'branched',
    morphology: null,
    fidelity: 'approx',
    source: 'ML66 Table 1',
    confidence: 'mid',
  },
  {
    id: 'composite/P2-plate-ends',
    mlCode: 'P2a/P2c',
    labelJa: '角板付六花・樹枝',
    from: 'branched',
    to: 'plate',
    morphology: null,
    fidelity: 'approx',
    source: 'ML66 §3.4',
    confidence: 'high',
  },
  {
    id: 'composite/P2-branched-ends',
    mlCode: 'P2f/P2g',
    labelJa: '扇・樹枝付角板',
    from: 'plate',
    to: 'branched',
    morphology: null,
    fidelity: 'approx',
    source: 'ML66 §3.4',
    confidence: 'high',
  },
  {
    id: 'composite/CP3-from-plate',
    mlCode: 'CP3',
    labelJa: '針・柱付板状',
    from: 'plate',
    to: 'needle-column',
    morphology: null,
    fidelity: 'approx',
    source: 'ML66 §3.7',
    confidence: 'high',
  },
  {
    id: 'composite/CP3-from-branched',
    mlCode: 'CP3',
    labelJa: '針・柱付板状',
    from: 'branched',
    to: 'needle-column',
    morphology: null,
    fidelity: 'approx',
    source: 'ML66 §3.7',
    confidence: 'high',
  },
];
