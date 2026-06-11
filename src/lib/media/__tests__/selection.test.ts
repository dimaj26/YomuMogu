import { describe, it, expect } from 'vitest';
import { selectPage } from '../selection';
import { Candidate } from '../ranking';

describe('Diversity and Infinite Refresh Selection', () => {
  const generatePool = (count: number): Candidate[] => {
    return Array.from({ length: count }, (_, i) => ({
      videoId: `video_${i}`,
      title: `Video Title ${i}`,
      channel: `Channel ${i}`
    }));
  };

  it('одинаковый seed → идентичная страница (детерминизм)', () => {
    const pool = generatePool(20);
    const history: string[] = [];
    const pageSize = 5;
    const seed = 12345;

    const res1 = selectPage(pool, history, pageSize, seed);
    const res2 = selectPage(pool, history, pageSize, seed);

    expect(res1.page).toEqual(res2.page);
  });

  it('при наличии непоказанных кандидатов пересечение страниц ≤10%', () => {
    const pool = generatePool(50);
    const history1: string[] = [];
    const pageSize = 10;
    
    // Выбираем первую страницу
    const res1 = selectPage(pool, history1, pageSize, 42);
    expect(res1.page.length).toBe(pageSize);
    
    // Добавляем выбранные видео в историю показанных
    const history2 = [...history1, ...res1.page.map(v => v.videoId)];
    
    // Выбираем вторую страницу с другим сидом
    const res2 = selectPage(pool, history2, pageSize, 43);
    expect(res2.page.length).toBe(pageSize);

    // Считаем пересечение
    const v1Ids = new Set(res1.page.map(v => v.videoId));
    let intersection = 0;
    for (const v of res2.page) {
      if (v1Ids.has(v.videoId)) intersection++;
    }

    // Пересечение должно быть <= 10% (то есть не более 1 видео для pageSize = 10)
    const intersectionPercent = intersection / pageSize;
    expect(intersectionPercent).toBeLessThanOrEqual(0.10);
  });

  it('исчерпание пула → сигнализирует exhausted: true', () => {
    const pool = generatePool(5);
    const history = ['video_0', 'video_1', 'video_2', 'video_3'];
    const pageSize = 3; // Нужно 3, но осталось только 1 не показанное
    
    const res = selectPage(pool, history, pageSize, 42);
    expect(res.page.length).toBe(3); // Должно набрать 3
    expect(res.exhausted).toBe(true);
  });

  it('полное исчерпание → повторы со старейших', () => {
    // Если все видео в пуле уже показаны, то мы берём те, которые были показаны раньше всего (в начале истории)
    const pool = generatePool(5); // video_0 .. video_4
    
    // История показанных: video_0 была показана первой, video_4 последней
    const history = ['video_0', 'video_1', 'video_2', 'video_3', 'video_4'];
    const pageSize = 2;
    
    const res = selectPage(pool, history, pageSize, 42);
    expect(res.page.length).toBe(2);
    
    // Должны повториться старейшие: video_0 и video_1
    const ids = res.page.map(v => v.videoId);
    expect(ids).toContain('video_0');
    expect(ids).toContain('video_1');
  });
});
