import { describe, it, expect } from 'vitest';
import { applyGradualFurigana, WordIntervalMap } from '../furigana';

describe('applyGradualFurigana', () => {
  it('неизвестное слово сохраняет полную фуригану', () => {
    const html = '<ruby>猫<rt>ねこ</rt></ruby>';
    const map: WordIntervalMap = {};
    expect(applyGradualFurigana(html, map)).toBe('<ruby>猫<rt>ねこ</rt></ruby>');
  });

  it('interval < 3 — фуригана без изменений', () => {
    const html = '<ruby>猫<rt>ねこ</rt></ruby>';
    const map: WordIntervalMap = { '猫': 2 };
    expect(applyGradualFurigana(html, map)).toBe('<ruby>猫<rt>ねこ</rt></ruby>');
  });

  it('interval 3..20 — rt получает класс rtFade', () => {
    const html = '<ruby>猫<rt>ねこ</rt></ruby>';
    const map: WordIntervalMap = { '猫': 10 };
    expect(applyGradualFurigana(html, map)).toBe('<ruby>猫<rt class="rtFade">ねこ</rt></ruby>');
  });

  it('interval >= 21 — rt получает класс rtHidden', () => {
    const html = '<ruby>猫<rt>ねこ</rt></ruby>';
    const map: WordIntervalMap = { '猫': 21 };
    expect(applyGradualFurigana(html, map)).toBe('<ruby>猫<rt class="rtHidden">ねこ</rt></ruby>');
  });

  it('текст без ruby возвращается без изменений', () => {
    const html = 'これは猫です。';
    const map: WordIntervalMap = { '猫': 30 };
    expect(applyGradualFurigana(html, map)).toBe('これは猫です。');
  });

  it('пустая карта интервалов — вход возвращается как есть', () => {
    const html = 'これは<ruby>猫<rt>ねこ</rt></ruby>です。';
    const map: WordIntervalMap = {};
    expect(applyGradualFurigana(html, map)).toBe('これは<ruby>猫<rt>ねこ</rt></ruby>です。');
  });

  it('несколько ruby в одной строке обрабатываются независимо', () => {
    const html = 'これは<ruby>猫<rt>ねこ</rt></ruby>と<ruby>犬<rt>いぬ</rt></ruby>です。';
    const map: WordIntervalMap = { '猫': 2, '犬': 25 };
    expect(applyGradualFurigana(html, map)).toBe(
      'これは<ruby>猫<rt>ねこ</rt></ruby>と<ruby>犬<rt class="rtHidden">いぬ</rt></ruby>です。'
    );
  });
});
