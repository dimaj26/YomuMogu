import { describe, it, expect } from 'vitest';
import { romajiToHiragana } from '../romaji';

describe('romajiToHiragana', () => {
  it('базовые слоги', () => {
    expect(romajiToHiragana('neko')).toBe('ねこ');
    expect(romajiToHiragana('inu')).toBe('いぬ');
    expect(romajiToHiragana('mizu')).toBe('みず');
    expect(romajiToHiragana('sakura')).toBe('さくら');
  });

  it('диграфы (ya/yu/yo) и особые слоги', () => {
    expect(romajiToHiragana('shashin')).toBe('しゃしん');
    expect(romajiToHiragana('kyou')).toBe('きょう');
    expect(romajiToHiragana('chuui')).toBe('ちゅうい');
    expect(romajiToHiragana('jugyou')).toBe('じゅぎょう');
  });

  it('особые: shi/chi/tsu/fu/ji', () => {
    expect(romajiToHiragana('shi')).toBe('し');
    expect(romajiToHiragana('chi')).toBe('ち');
    expect(romajiToHiragana('tsu')).toBe('つ');
    expect(romajiToHiragana('fu')).toBe('ふ');
    expect(romajiToHiragana('fuji')).toBe('ふじ');
  });

  it('сокку (っ) — удвоенная согласная', () => {
    expect(romajiToHiragana('gakkou')).toBe('がっこう');
    expect(romajiToHiragana('kitte')).toBe('きって');
    expect(romajiToHiragana('zasshi')).toBe('ざっし');
  });

  it('ん: в конце, перед согласной, nn', () => {
    expect(romajiToHiragana('nihon')).toBe('にほん');
    expect(romajiToHiragana('sensei')).toBe('せんせい');
    expect(romajiToHiragana('onna')).toBe('おんな');
    expect(romajiToHiragana('sanpo')).toBe('さんぽ');
  });

  it('n перед гласной — это слог na/ni/..., а не ん', () => {
    expect(romajiToHiragana('na')).toBe('な');
    expect(romajiToHiragana('nani')).toBe('なに');
  });

  it('уже-кана и кандзи пробрасываются без изменений', () => {
    expect(romajiToHiragana('ねこ')).toBe('ねこ');
    expect(romajiToHiragana('猫')).toBe('猫');
    // смешанный ввод: латиница конвертится, кана остаётся
    expect(romajiToHiragana('ねko')).toBe('ねこ');
  });

  it('регистр и пустые значения', () => {
    expect(romajiToHiragana('Neko')).toBe('ねこ');
    expect(romajiToHiragana('')).toBe('');
  });
});
