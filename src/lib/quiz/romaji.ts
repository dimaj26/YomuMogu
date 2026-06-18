/**
 * Конвертер ромадзи → хирагана для ввода без японской раскладки.
 *
 * Чистая детерминированная функция. Уже-кана и кандзи пробрасываются без
 * изменений (пользователь с IME не страдает). Незавершённые латинские хвосты
 * (например одиночная согласная при наборе) остаются как есть.
 */

// Карта слогов ромадзи → хирагана (диграфы и особые слоги — длиннее, проверяются первыми)
const ROMAJI_MAP: Record<string, string> = {
  // 3-символьные диграфы
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ', sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ', jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ',
  // особые 2-3 символьные
  shi: 'し', chi: 'ち', tsu: 'つ',
  // базовые 2-символьные
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', si: 'し', su: 'す', se: 'せ', so: 'そ',
  za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ta: 'た', ti: 'ち', tu: 'つ', te: 'て', to: 'と',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wo: 'を',
  // гласные
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
};

const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);

function isLatinLetter(ch: string): boolean {
  return /[a-z]/.test(ch);
}

export function romajiToHiragana(input: string): string {
  if (!input) return '';
  const s = input.toLowerCase();
  let result = '';
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    // Не латиница (кана/кандзи/пробел/цифра) — пробрасываем как есть
    if (!isLatinLetter(ch)) {
      result += input[i]; // сохраняем исходный регистр/символ
      i++;
      continue;
    }

    // Обработка «n» → ん: одиночная n в конце или перед согласной (кроме y).
    // Перед гласной или y — это слог na/ni/.../nya (обрабатывается картой ниже).
    // Случай «nn» (напр. onna) попадает сюда: первая n → ん (поглощаем 1), затем «na» → な.
    if (ch === 'n') {
      const next = s[i + 1];
      if (!next || (!VOWELS.has(next) && next !== 'y')) {
        result += 'ん';
        i += 1;
        continue;
      }
    }

    // Сокку (っ): удвоенная согласная (не гласная, не «n»)
    const next = s[i + 1];
    if (ch !== 'n' && !VOWELS.has(ch) && next === ch) {
      result += 'っ';
      i += 1;
      continue;
    }

    // Жадно сопоставляем слог: 3 → 2 → 1 символа
    let matched = false;
    for (let len = 3; len >= 1; len--) {
      const token = s.substr(i, len);
      if (ROMAJI_MAP[token]) {
        result += ROMAJI_MAP[token];
        i += len;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Незавершённый хвост (одиночная согласная) — оставляем как есть
      result += input[i];
      i++;
    }
  }

  return result;
}
