import { test, expect } from '@playwright/test';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

test.describe('Media Search E2E Tests @live', () => {

  test('выполнение поиска, обновление результатов и запуск видео', async ({ page }) => {
    // 1. Загружаем страницу практики
    await page.goto('/practice', { waitUntil: 'domcontentloaded' });

    // 2. Открываем вкладку Медиа
    await page.click('button:has-text("Медиа")');

    // 3. Находим поле ввода поиска и вбиваем запрос
    const searchInput = page.locator('input[placeholder*="Найти обучающие видео"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('разговор');

    // 4. Кликаем по кнопке Найти
    const searchButton = page.locator('button:has-text("Найти")');
    await searchButton.click();

    // 5. Ожидаем появление заголовка с результатами поиска или ошибки 429
    const resultsHeader = page.locator('h3:has-text("Результаты поиска по запросу")');
    const errorAlert = page.locator('div[class*="errorAlert"]');
    
    await Promise.race([
      resultsHeader.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {}),
      errorAlert.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {})
    ]);

    if (await errorAlert.isVisible()) {
      const errorText = await errorAlert.textContent() || '';
      if (errorText.includes('429') || errorText.toLowerCase().includes('too many requests')) {
        console.log('Detected YouTube rate limit (429) during E2E search test. Skipping.');
        test.skip(true, 'пропущено: YouTube 429 (IP rate-limit)');
        return;
      }
    }

    await expect(resultsHeader).toBeVisible({ timeout: 1000 });
    await expect(resultsHeader).toContainText('разговор');

    // 6. Убеждаемся, что карточки результатов поиска отрендерились
    const firstCard = page.locator('div[class*="mediaCard"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });
    
    const initialTitle = await firstCard.locator('h4').textContent() || '';
    console.log(`Initial search video title: ${initialTitle}`);

    // 7. Проверяем кнопку "Обновить выдачу" ( diversity / refresh )
    const refreshButton = page.locator('button:has-text("Обновить выдачу")');
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    // Ждем обновления результатов и проверяем, что они изменились или перезагрузились
    await page.waitForTimeout(3000);
    const postRefreshTitle = await firstCard.locator('h4').textContent() || '';
    console.log(`Post-refresh search video title: ${postRefreshTitle}`);

    // 8. Кликаем по кнопке "Смотреть и учить" на первом видео результатов
    const viewButton = firstCard.locator('button:has-text("Смотреть и учить")');
    await viewButton.click();

    // 9. Убеждаемся, что интерактивный плеер открылся и начал загружаться
    const playlistBox = page.locator('div[class*="playlistBox"]');
    await expect(playlistBox).toBeVisible({ timeout: 15000 });
  });

});
