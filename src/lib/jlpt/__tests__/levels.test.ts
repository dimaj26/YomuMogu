import { describe, it, expect } from 'vitest';
import { getJlptLevel, toJlptTag, mergeJlptTag } from '../levels';
import jlptLevels from '../../../resources/jlpt_levels.json';

describe('JLPT levels detection', () => {
  it('находит уровень по точной канзи-форме слова', () => {
    // В N5 должен быть "студент/ученик" - 学生 (がくせい)
    expect(getJlptLevel('学生')).toBe('N5');
    expect(getJlptLevel('学生', 'がくせい')).toBe('N5');
  });

  it('находит уровень кана-слова по чтению', () => {
    // Поиск по чтению каной для кандзи-слова
    expect(getJlptLevel('がくせい')).toBe('N5');
    // Поиск слова, записанного только каной
    expect(getJlptLevel('あっち')).toBe('N5');
  });

  it('возвращает null для слова вне списков', () => {
    expect(getJlptLevel('несуществующееслово')).toBeNull();
  });

  it('при конфликте уровней побеждает более простой (N5 над N4)', () => {
    expect(getJlptLevel('学生')).toBe('N5'); 
  });

  it('toJlptTag формирует канонический тег jlpt:n5', () => {
    expect(toJlptTag('N5')).toBe('jlpt:n5');
    expect(toJlptTag('N4')).toBe('jlpt:n4');
    expect(toJlptTag('N1')).toBe('jlpt:n1');
  });

  it('mergeJlptTag идемпотентен и не дублирует jlpt-теги', () => {
    // Начинаем с пустого списка
    let tags: string[] = [];
    tags = mergeJlptTag(tags, 'N5');
    expect(tags).toEqual(['jlpt:n5']);

    // Повторное добавление того же тега
    tags = mergeJlptTag(tags, 'N5');
    expect(tags).toEqual(['jlpt:n5']);

    // Добавление более сложного тега (N4) - должен остаться более простой (N5)
    tags = mergeJlptTag(tags, 'N4');
    expect(tags).toEqual(['jlpt:n5']);

    // Если был N4, а добавляется N5 - должен замениться на N5
    let tags2 = ['jlpt:n4'];
    tags2 = mergeJlptTag(tags2, 'N5');
    expect(tags2).toEqual(['jlpt:n5']);

    // Другие теги должны сохраняться
    let tags3 = ['custom-tag', 'jlpt:n4'];
    tags3 = mergeJlptTag(tags3, 'N5');
    expect(tags3).toContain('custom-tag');
    expect(tags3).toContain('jlpt:n5');
    expect(tags3).not.toContain('jlpt:n4');
  });

  it('ресурс jlpt_levels.json валиден: meta заполнена, N5 содержит не менее 500 записей', () => {
    expect(jlptLevels.meta).toBeDefined();
    expect(jlptLevels.meta.source).toBeDefined();
    expect(jlptLevels.meta.fetchedAt).toBeDefined();
    expect(jlptLevels.levels).toBeDefined();
    expect(jlptLevels.levels.N5.length).toBeGreaterThanOrEqual(500);
  });
});
