import { describe, it, expect } from 'vitest';
import { TITLE_MAP, getGlobalLabel, getSubtypeCode } from './classify';

// 案 M(CP-M2)の分類ラベル検証(設計書 §3.3・§5-7)。

describe('案M 分類ラベル — 星状・羊歯・長柱', () => {
  it('a. TITLE_MAP に新 3 形態のエントリ(ja / en)', () => {
    expect(TITLE_MAP['星状']).toEqual({ ja: '星状', en: 'Stellar Crystal' });
    expect(TITLE_MAP['羊歯']).toEqual({ ja: '羊歯', en: 'Fernlike Crystal' });
    expect(TITLE_MAP['長柱']).toEqual({ ja: '長柱', en: 'Long Solid Column' });
  });

  it("b. グローバル分類コードは未割当('') — ML66 領域コードとの体系衝突のため(裁量 1・専門家確認 (4) へ追補)", () => {
    for (const m of ['星状', '羊歯', '長柱'] as const) {
      expect(getGlobalLabel(m)).toBe('');
      expect(getSubtypeCode(m)).toBe('');
    }
  });
});
