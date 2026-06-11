import { test, expect } from '@playwright/test';
import { getYoutubeTranscriptSegments } from '../../src/lib/media/youtube';

test.describe('Live Subtitles, Karaoke & Dictionary E2E Tests @live', () => {

  test('субтитры в плеере соответствуют реальным субтитрам видео (live, без моков)', async ({ page }) => {
    // 1. Загружаем страницу
    await page.goto('/practice', { waitUntil: 'domcontentloaded' });

    // 2. Открываем вкладку Медиа
    await page.click('button:has-text("Медиа")');

    // 3. Выбираем первое видео "Сэнсэй Шун - О себе (Genki 1: L1)"
    const firstCard = page.locator('div[class*="mediaCard"]').first();
    const titleText = await firstCard.locator('h4').textContent() || '';
    console.log(`Testing video: ${titleText}`);
    
    // Получаем videoId из ссылки
    const viewButton = firstCard.locator('button:has-text("Смотреть и учить")');
    await viewButton.click();

    // Ждем загрузки плейлиста сегментов
    const playlist = page.locator('div[class*="playlistBox"]');
    await expect(playlist).toBeVisible({ timeout: 15000 });

    // Находим все отрендеренные строки субтитров в UI
    const renderedTexts = await page.locator('div[class*="segmentRow"] span[class*="segmentText"]').allTextContents();
    expect(renderedTexts.length).toBeGreaterThan(0);

    // Получаем реальные субтитры с YouTube через скрейпер
    const videoId = 'Jnea4HbYIso'; // ID первого видео
    const scrapedSegments = await getYoutubeTranscriptSegments(videoId);
    expect(scrapedSegments.length).toBeGreaterThan(0);

    // Функция для нормализации текста субтитров
    const normalize = (t: string) => t.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()？!。、\s]/g, '');

    // Проверяем, сколько отрендеренных строк соответствуют реальным
    let matches = 0;
    const limit = Math.min(15, renderedTexts.length);
    for (let i = 0; i < limit; i++) {
      const rendered = normalize(renderedTexts[i]);
      const matched = scrapedSegments.some(scraped => {
        const scr = normalize(scraped.text);
        return scr.includes(rendered) || rendered.includes(scr);
      });
      if (matched) matches++;
    }

    const matchPercentage = (matches / limit) * 100;
    console.log(`Fidelity match percentage: ${matchPercentage}%`);
    expect(matchPercentage).toBeGreaterThanOrEqual(60);
  });

  test('караоке подсвечивает слово во время воспроизведения (live)', async ({ page }) => {
    await page.goto('/practice', { waitUntil: 'domcontentloaded' });
    await page.click('button:has-text("Медиа")');
    await page.locator('div[class*="mediaCard"]').first().locator('button:has-text("Смотреть и учить")').click();

    // Ждем загрузки сегментов
    const firstSegment = page.locator('div[class*="segmentRow"]').first();
    await expect(firstSegment).toBeVisible({ timeout: 15000 });

    // Кликаем по первому сегменту субтитров для симуляции воспроизведения в этой временной метке
    await firstSegment.click({ force: true });

    // Убеждаемся, что первый сегмент активен в UI
    await expect(firstSegment).toHaveClass(/segmentRowActive/);

    // Ожидаем появление токенов слов (чтобы отработал MeCab)
    const token = page.locator('span[class*="wordToken"]').first();
    await expect(token).toBeVisible({ timeout: 10000 });

    // Так как воспроизведение идет на живом видео, проверяем подсветку слова.
    // Ожидаем, что хотя бы один токен получит класс activeWord
    const activeWordToken = page.locator('span[class*="activeWord"]').first();
    await expect(activeWordToken).toBeVisible({ timeout: 5000 });
  });

  test('клик по токену открывает словарную карточку (live, реальный MeCab)', async ({ page }) => {
    await page.goto('/practice', { waitUntil: 'domcontentloaded' });
    await page.click('button:has-text("Медиа")');
    await page.locator('div[class*="mediaCard"]').first().locator('button:has-text("Смотреть и учить")').click();

    // Ждем загрузки сегментов
    const firstSegment = page.locator('div[class*="segmentRow"]').first();
    await expect(firstSegment).toBeVisible({ timeout: 15000 });
    await firstSegment.click({ force: true });

    // Ждем токенизацию MeCab
    const tokens = page.locator('span[class*="wordToken"]');
    await expect(tokens.first()).toBeVisible({ timeout: 10000 });

    // Находим осмысленное слово для клика (например, существительное или глагол)
    const count = await tokens.count();
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const token = tokens.nth(i);
      const text = await token.textContent() || '';
      // Кликаем только по иероглифам или словам длиннее 1 символа, чтобы избежать знаков препинания
      if (text.length > 1 || /[\u4e00-\u9faf]/.test(text)) {
        console.log(`Clicking word token: ${text}`);
        await token.click();
        clicked = true;
        break;
      }
    }
    expect(clicked).toBe(true);

    // Проверяем открытие словарной карточки и загрузку из JitenDex
    const dictHtml = page.locator('div[class*="dictHtml"]');
    await expect(dictHtml).toBeVisible({ timeout: 10000 });
    
    const content = await dictHtml.textContent() || '';
    expect(content.trim().length).toBeGreaterThan(0);
    expect(content).not.toContain('Определение не найдено');
    expect(content).not.toContain('Ошибка связи со словарем');
  });

});
