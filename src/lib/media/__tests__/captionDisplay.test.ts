import { describe, it, expect } from 'vitest';
import { stripCaptionAnnotations, stripAnnotationWords } from '../captionDisplay';

describe('stripCaptionAnnotations', () => {
  it('срезает звуковые теги в квадратных и угловых скобках', () => {
    expect(stripCaptionAnnotations('[音楽]')).toBe('');
    expect(stripCaptionAnnotations('[拍手]')).toBe('');
    expect(stripCaptionAnnotations('【音楽】')).toBe('');
    expect(stripCaptionAnnotations('[Music]')).toBe('');
  });

  it('срезает инлайн-тег из смешанного сегмента, оставляя речь', () => {
    expect(stripCaptionAnnotations('[音楽] こんにちは')).toBe('こんにちは');
    expect(stripCaptionAnnotations('こんにちは [拍手]')).toBe('こんにちは');
  });

  it('сохраняет ♪ (осмысленный медиа-контент) и обычные круглые скобки', () => {
    expect(stripCaptionAnnotations('♪ ラララ ♪')).toBe('♪ ラララ ♪');
    expect(stripCaptionAnnotations('日本語（にほんご）')).toBe('日本語（にほんご）');
  });

  it('схлопывает лишние пробелы после среза и тримит', () => {
    expect(stripCaptionAnnotations('[音楽]   テスト   [拍手]')).toBe('テスト');
  });

  it('пустой/undefined вход возвращает пустую строку', () => {
    expect(stripCaptionAnnotations('')).toBe('');
    // @ts-expect-error проверка устойчивости к undefined
    expect(stripCaptionAnnotations(undefined)).toBe('');
  });
});

describe('stripAnnotationWords', () => {
  it('выбрасывает слова, которые целиком являются аннотацией, сохраняя речевые', () => {
    const words = [
      { text: '[音楽]', offsetMs: 0 },
      { text: 'こんにちは', offsetMs: 500 },
      { text: '世界', offsetMs: 900 },
    ];
    expect(stripAnnotationWords(words)).toEqual([
      { text: 'こんにちは', offsetMs: 500 },
      { text: '世界', offsetMs: 900 },
    ]);
  });

  it('синхронность: totalChars речевого подмножества совпадает после среза', () => {
    const words = [
      { text: '[音楽]', offsetMs: 0 },
      { text: 'こんにちは', offsetMs: 500 },
    ];
    const speech = stripAnnotationWords(words);
    const totalChars = speech.reduce((s, w) => s + w.text.length, 0);
    expect(totalChars).toBe('こんにちは'.length);
  });

  it('undefined/пустой массив возвращает пустой массив', () => {
    expect(stripAnnotationWords(undefined)).toEqual([]);
    expect(stripAnnotationWords([])).toEqual([]);
  });
});
