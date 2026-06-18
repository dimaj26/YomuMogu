/**
 * Сравнивает введенный пользователем ответ с ожидаемым значением с учетом нечеткого соответствия (удаление пробелов).
 *
 * @param input Введенный пользователем ответ
 * @param expected Ожидаемый правильный ответ
 * @returns true, если ответы совпадают (без учета пробелов)
 */
import { romajiToHiragana } from './romaji';

export function isAnswerAcceptable(input: string, expected: string): boolean {
  if (!input || !expected) return false;
  const normalizedInput = input.trim().replace(/[\s\u3000]+/g, '');
  const normalizedExpected = expected.trim().replace(/[\s\u3000]+/g, '');
  if (normalizedInput === normalizedExpected) return true;
  // \u041f\u0440\u0438\u0451\u043c \u0440\u043e\u043c\u0430\u0434\u0437\u0438 \u0431\u0435\u0437 \u044f\u043f\u043e\u043d\u0441\u043a\u043e\u0439 \u0440\u0430\u0441\u043a\u043b\u0430\u0434\u043a\u0438: \u043a\u043e\u043d\u0432\u0435\u0440\u0442\u0438\u0440\u0443\u0435\u043c \u0432\u0432\u043e\u0434 \u0432 \u0445\u0438\u0440\u0430\u0433\u0430\u043d\u0443 \u0438 \u0441\u0440\u0430\u0432\u043d\u0438\u0432\u0430\u0435\u043c
  return romajiToHiragana(normalizedInput) === normalizedExpected;
}
