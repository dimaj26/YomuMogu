import scienceTipsData from '../../resources/science_tips.json';

export interface Tip {
  id: string;
  title: string;
  body: string;
  source: string;
}

// Приведем тип импортированных данных
const tipsList = scienceTipsData.tips as Tip[];

export const TIP_IDS: readonly string[] = tipsList.map(tip => tip.id);

/**
 * Возвращает научную подсказку по её ID. Если ID не найден, возвращает null.
 * Никогда не выбрасывает исключений.
 */
export function getTip(id: string): Tip | null {
  try {
    const tip = tipsList.find(t => t.id === id);
    return tip || null;
  } catch {
    // В случае непредвиденных ошибок возвращаем null, чтобы не сломать вызывающий код
    return null;
  }
}
