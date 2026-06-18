import { describe, it, expect } from 'vitest';
import { isAnswerAcceptable } from '../compare';

describe('isAnswerAcceptable', () => {
  it('точный ответ принимается', () => {
    expect(isAnswerAcceptable('ねこ', 'ねこ')).toBe(true);
    expect(isAnswerAcceptable('猫', '猫')).toBe(true);
  });

  it('ответ с одной опечаткой принимается', () => {
    // В квиз-тестах "опечатка" моделируется удалением пробелов (например, 'ね こ' -> 'ねこ')
    expect(isAnswerAcceptable('ね  こ', 'ねこ')).toBe(true);
    expect(isAnswerAcceptable('ね　こ', 'ねこ')).toBe(true); // полноширинный пробел (U+3000)
    expect(isAnswerAcceptable('ねこ', 'ね  こ')).toBe(true);
  });

  it('неверный ответ отклоняется', () => {
    expect(isAnswerAcceptable('いぬ', 'ねこ')).toBe(false);
    expect(isAnswerAcceptable('ねこ_ошибка', 'ねこ')).toBe(false);
    expect(isAnswerAcceptable('', 'ねこ')).toBe(false);
    expect(isAnswerAcceptable('ねこ', '')).toBe(false);
  });

  it('ромадзи принимается (ввод без японской раскладки)', () => {
    expect(isAnswerAcceptable('neko', 'ねこ')).toBe(true);
    expect(isAnswerAcceptable('nihon', 'にほん')).toBe(true);
    expect(isAnswerAcceptable('gakkou', 'がっこう')).toBe(true);
    expect(isAnswerAcceptable('Sensei', 'せんせい')).toBe(true); // регистр игнорируется
  });

  it('неверный ромадзи отклоняется', () => {
    expect(isAnswerAcceptable('inu', 'ねこ')).toBe(false);
  });
});
