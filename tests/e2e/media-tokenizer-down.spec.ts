import { test, expect } from '@playwright/test';

test.describe('MeCab Tokenizer Offline E2E Tests', () => {
  test('токенизатор недоступен → предупреждение видно, подсветка слов отсутствует', async ({ page }) => {
    test.setTimeout(60000);
    // Позволяем Next.js серверу сделать реальный запрос к MeCab, который упадет,
    // так как в офлайн-режиме токенизатор выключен.

    await page.goto('/practice', { waitUntil: 'domcontentloaded' });

    // Кликаем по вкладке "Медиа"
    await page.click('button:has-text("Медиа")');

    // Нажимаем на первое видео для открытия плеера
    await page.locator('div[class*="mediaCard"]:has-text("Сэнсэй Шун - О себе (Genki 1: L1)")')
      .locator('button:has-text("Смотреть и учить")')
      .click();

    // Выбираем первый сегмент, чтобы активировать его
    const playlistItem = page.locator('div[class*="segmentRow"]').first();
    await expect(playlistItem).toBeVisible();
    await playlistItem.click({ force: true });

    // Должен отобразиться баннер предупреждения
    const warningBanner = page.locator('[data-testid="tokenizer-warning"]');
    await expect(warningBanner).toBeVisible({ timeout: 5000 });
    await expect(warningBanner).toContainText('Разбор слов недоступен');

    // Проверяем, что подсветка слов отсутствует (нет элементов word-token)
    const wordTokens = page.locator('[data-testid="word-token"]');
    const count = await wordTokens.count();
    expect(count).toBe(0);
  });
});
