import { describe, it, expect } from 'vitest';
import { getTip, TIP_IDS } from '../tips';

describe('Science Tips Library', () => {
  it('getTip возвращает тип по id с полями title/body/source', () => {
    const tip = getTip('furigana');
    expect(tip).not.toBeNull();
    expect(tip).toHaveProperty('title');
    expect(tip).toHaveProperty('body');
    expect(tip).toHaveProperty('source');
    expect(typeof tip?.title).toBe('string');
    expect(typeof tip?.body).toBe('string');
    expect(typeof tip?.source).toBe('string');
  });

  it('getTip на неизвестный id возвращает null', () => {
    const tip = getTip('unknown_id_xyz');
    expect(tip).toBeNull();
  });

  it('все 8 обязательных id присутствуют в реестре', () => {
    const requiredIds = [
      'furigana',
      'self_repair',
      'chat_first',
      'spacing',
      'grammar_explicit',
      'typed_answer',
      'no_streaks',
      'balance'
    ];
    for (const id of requiredIds) {
      expect(TIP_IDS).toContain(id);
      const tip = getTip(id);
      expect(tip).not.toBeNull();
    }
  });
});
