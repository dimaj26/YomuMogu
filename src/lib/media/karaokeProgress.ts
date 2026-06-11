/**
 * Вычисляет долю заполнения караоке-подсветки в диапазоне [0, 1].
 * Использует кусочно-линейную интерполяцию по символам.
 * 
 * @param relativeTimeMs Текущее время относительно начала сегмента (в миллисекундах)
 * @param durationMs Длительность сегмента (в миллисекундах)
 * @param words Массив слов с временными метками offsetMs
 */
export function computeFillFraction(
  relativeTimeMs: number,
  durationMs: number,
  words?: Array<{ text: string; offsetMs: number }>
): number {
  // 1. Ограничиваем время рамками [0, durationMs]
  const t = Math.max(0, Math.min(durationMs, relativeTimeMs));

  if (durationMs <= 0) return 0;
  if (t <= 0) return 0;
  if (t >= durationMs) return 1;

  // 2. Если слов нет, используем простую линейную интерполяцию по времени
  if (!words || words.length === 0) {
    return t / durationMs;
  }

  // Вычисляем суммарное количество символов
  let totalChars = 0;
  for (const w of words) {
    totalChars += w.text.length;
  }

  if (totalChars === 0) {
    return t / durationMs;
  }

  // 3. Строим опорные точки (анкоры)
  // Анкор k сопоставляет offsetMs(k) -> charStart(k) / totalChars
  const anchors: Array<{ time: number; progress: number }> = [];

  // Добавляем начальную точку на t=0
  anchors.push({ time: 0, progress: 0 });

  let currentChars = 0;
  for (let k = 0; k < words.length; k++) {
    anchors.push({
      time: words[k].offsetMs,
      progress: currentChars / totalChars,
    });
    currentChars += words[k].text.length;
  }

  // Добавляем финальную точку на конец сегмента
  anchors.push({ time: durationMs, progress: 1.0 });

  // 4. Ищем отрезок [anchors[low], anchors[high]], в который попадает t
  let low = 0;
  let high = anchors.length - 1;

  for (let i = 0; i < anchors.length - 1; i++) {
    if (t >= anchors[i].time && t <= anchors[i + 1].time) {
      low = i;
      high = i + 1;
    }
  }

  // 5. Интерполируем
  const a1 = anchors[low];
  const a2 = anchors[high];

  if (a1.time === a2.time) {
    return a2.progress;
  }

  return a1.progress + ((t - a1.time) / (a2.time - a1.time)) * (a2.progress - a1.progress);
}

/**
 * Интерполирует текущее время плеера на основе времени последнего опроса (poll)
 * и времени, прошедшего с момента этого опроса.
 * 
 * @param lastPoll Время последнего опроса плеера (в секундах)
 * @param lastPollAtMs Временная метка performance.now() в момент последнего опроса
 * @param nowMs Текущая временная метка performance.now()
 * @param isPlaying Играет ли плеер в данный момент
 */
export function interpolatePlayerTime(
  lastPoll: number,
  lastPollAtMs: number,
  nowMs: number,
  isPlaying: boolean
): number {
  if (!isPlaying) {
    return lastPoll;
  }

  const deltaSeconds = (nowMs - lastPollAtMs) / 1000;
  return lastPoll + Math.max(0, deltaSeconds);
}
