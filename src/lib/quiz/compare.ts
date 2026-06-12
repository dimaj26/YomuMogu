/**
 * Сравнивает введенный пользователем ответ с ожидаемым значением с учетом нечеткого соответствия (удаление пробелов).
 *
 * @param input Введенный пользователем ответ
 * @param expected Ожидаемый правильный ответ
 * @returns true, если ответы совпадают (без учета пробелов)
 */
export function isAnswerAcceptable(input: string, expected: string): boolean {
  if (!input || !expected) return false;
  const normalizedInput = input.trim().replace(/[\s\u3000]+/g, '');
  const normalizedExpected = expected.trim().replace(/[\s\u3000]+/g, '');
  return normalizedInput === normalizedExpected;
}
