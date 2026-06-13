import { describe, it, expect, beforeEach } from 'vitest';
import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb';
globalThis.indexedDB = fakeIndexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

import { db } from '../db';
import { recordExposure, getMiningCandidates } from '../exposureService';

describe('Exposure Log Service', () => {
  beforeEach(async () => {
    // Очищаем таблицы перед каждым тестом.
    await db.words.clear();
    if (db.table('exposure_log')) {
      await db.table('exposure_log').clear();
    }
  });

  it('recordExposure: первая встреча создаёт count=1 с firstSeen', async () => {
    const profileId = 'test-profile';
    const words = ['りんご', 'みかん'];
    await recordExposure(profileId, words, 'chat');

    const entry1 = await db.table('exposure_log').get([profileId, 'りんご']);
    expect(entry1).toBeDefined();
    expect(entry1.count).toBe(1);
    expect(entry1.firstSeen).toBeDefined();
    expect(entry1.lastSeen).toBe(entry1.firstSeen);
    expect(entry1.source).toBe('chat');

    const entry2 = await db.table('exposure_log').get([profileId, 'みかん']);
    expect(entry2).toBeDefined();
    expect(entry2.count).toBe(1);
  });

  it('recordExposure: повторная встреча инкрементит count и двигает lastSeen', async () => {
    const profileId = 'test-profile';
    const word = 'りんご';

    await recordExposure(profileId, [word], 'chat');
    const firstEntry = await db.table('exposure_log').get([profileId, word]);
    const firstLastSeen = firstEntry.lastSeen;

    // Ждем 2мс, чтобы timestamp изменился
    await new Promise(resolve => setTimeout(resolve, 2));

    await recordExposure(profileId, [word], 'chat');
    const secondEntry = await db.table('exposure_log').get([profileId, word]);

    expect(secondEntry.count).toBe(2);
    expect(secondEntry.firstSeen).toBe(firstEntry.firstSeen);
    expect(secondEntry.lastSeen).toBeGreaterThan(firstLastSeen);
  });

  it('recordExposure: слова из стоп-листа и уже изучаемые игнорируются', async () => {
    const profileId = 'test-profile';
    
    // Добавим одно слово в изучаемые (таблица words)
    await db.words.add({
      profileId,
      id: 12345,
      word: 'りんご',
      reading: '',
      translation: 'яблоко',
      category: 'default',
      source: 'anki',
      active: { status: 'learning', stability: 1, difficulty: 5, interval: 1, due: Date.now(), reps: 1, lapses: 0 },
      passive: { status: 'learning', stability: 1, difficulty: 5, interval: 1, due: Date.now(), reps: 1, lapses: 0 }
    });

    // Будем записывать встречу для трех слов:
    // 1. りんご (уже изучается)
    // 2. は (в стоп-листе)
    // 3. ばなな (новое слово, должно записаться)
    await recordExposure(profileId, ['りんご', 'は', 'ばなな'], 'chat');

    const entryRingo = await db.table('exposure_log').get([profileId, 'りんご']);
    expect(entryRingo).toBeUndefined();

    const entryHa = await db.table('exposure_log').get([profileId, 'は']);
    expect(entryHa).toBeUndefined();

    const entryBanana = await db.table('exposure_log').get([profileId, 'ばなな']);
    expect(entryBanana).toBeDefined();
    expect(entryBanana.count).toBe(1);
  });

  it('getMiningCandidates: возвращает слова с count>=порога по убыванию', async () => {
    const profileId = 'test-profile';

    const logTable = db.table('exposure_log');
    
    // Добавим записи вручную
    await logTable.add({ profileId, word: 'слово1', count: 3, firstSeen: Date.now(), lastSeen: Date.now(), source: 'chat' });
    await logTable.add({ profileId, word: 'слово2', count: 5, firstSeen: Date.now(), lastSeen: Date.now(), source: 'chat' });
    await logTable.add({ profileId, word: 'слово3', count: 8, firstSeen: Date.now(), lastSeen: Date.now(), source: 'chat' });

    const candidates = await getMiningCandidates(profileId);
    
    expect(candidates.length).toBe(2);
    expect(candidates[0].word).toBe('слово3');
    expect(candidates[1].word).toBe('слово2');
  });
});
