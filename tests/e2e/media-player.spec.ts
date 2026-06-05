import { test, expect } from '@playwright/test';

test.describe('Media Recommendation & Player E2E Tests', () => {
  
  // Тезис 1: Проверка обработки сбоя токенизатора MeCab (вывод ошибки вместо бесконечной загрузки)
  test('should display user-friendly error message when tokenizer is offline', async ({ page }) => {
    // Перехватываем API-запрос к парсеру и возвращаем 503 Service Unavailable
    await page.route('**/api/media/parse', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Сервер токенизации временно недоступен' }),
      });
    });

    await page.goto('/practice');

    // Кликаем по вкладке "Медиа"
    await page.click('button:has-text("Медиа")');

    // Нажимаем на первое видео для открытия плеера
    await page.click('text=Сэнсэй Шун - Знакомство с друзьями');

    // Ожидаем появление карточки с ошибкой
    const errorMsg = page.locator('p[class*="errorMsg"]');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
    await expect(errorMsg).toContainText('Сервер токенизации временно недоступен');

    // Убеждаемся, что отображается резервная зона Drag-and-Drop для пользовательских субтитров
    await expect(page.locator('div[class*="dragBox"]')).toBeVisible();
  });

  // Тезис 2: Проверка отсутствия нарушений CSP (Content Security Policy) при инициализации YouTube плеера
  test('should load YouTube Iframe Player without CSP policy violations', async ({ page }) => {
    const cspViolations: string[] = [];

    // Регистрируем обработчик нарушений CSP в контексте страницы до ее загрузки
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        // Игнорируем расширения Chrome и прочие внешние шумы, отслеживаем только наш домен
        if (e.blockedURI && !e.blockedURI.includes('chrome-extension')) {
          (window as any)._cspViolations = (window as any)._cspViolations || [];
          (window as any)._cspViolations.push(e.blockedURI);
        }
      });
    });

    await page.goto('/practice');
    await page.click('button:has-text("Медиа")');
    await page.click('text=Сэнсэй Шун - Знакомство с друзьями');

    // Даем плееру время на инициализацию iframe и загрузку скриптов
    await page.waitForTimeout(2000);

    // Проверяем наличие зафиксированных браузером нарушений CSP
    const violations = await page.evaluate(() => (window as any)._cspViolations || []);
    expect(violations).toHaveLength(0);

    // Убеждаемся, что iframe с YouTube успешно создан и внедрен в DOM
    const iframe = page.locator('iframe#youtube-player-iframe');
    await expect(iframe).toBeVisible();
  });

  // Тезис 3: Проверка успешной загрузки кэшированных субтитров и рендеринга интерактивных слов
  test('should load static fallback subtitles and render interactive word tokens successfully', async ({ page }) => {
    const mockSegments = [
      { start: 0, duration: 3, text: 'こんにちは、元気ですか？' }
    ];

    // Мокаем успешный разбор медиа (возвращаем кэшированные сегменты)
    await page.route('**/api/media/parse', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          segments: mockSegments,
          lemmas: ['こんにちは', '元気'],
          cached: false
        }),
      });
    });

    // Мокаем успешную токенизацию MeCab при смене сегмента
    await page.route('**/api/media/tokenize', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tokens: [
            { surface: 'こんにちは', pos: '感動詞', lemma: 'こんにちは', reading: 'コンニチハ' },
            { surface: '、', pos: '補助記号', lemma: '、', reading: null },
            { surface: '元気', pos: '名詞', lemma: '元気', reading: 'ゲンキ' },
            { surface: 'です', pos: '助動詞', lemma: 'です', reading: 'デス' },
            { surface: 'か', pos: '助詞', lemma: 'か', reading: 'カ' },
            { surface: '？', pos: '補助記号', lemma: '？', reading: null }
          ]
        }),
      });
    });

    await page.goto('/practice');
    await page.click('button:has-text("Медиа")');
    await page.click('text=Сэнсэй Шун - Знакомство с друзьями');

    // Эмулируем запуск воспроизведения (время плеера выставляем в 1 сек, чтобы активировать сегмент)
    // В компоненте это вызовет поиск активного сегмента и запрос к /api/media/tokenize
    await page.evaluate(() => {
      // Имитируем событие обновления времени воспроизведения на 1.0 сек
      const playerEl = document.querySelector('div[class*="subtitlesContainer"]');
      if (playerEl) {
        // Мы можем напрямую вызвать событие клика по строке плейлиста для активации
        const playlistItem = document.querySelector('div[class*="segmentRow"]');
        if (playlistItem) {
          (playlistItem as HTMLDivElement).click();
        }
      }
    });

    // Ждем окончания токенизации и проверяем, что слово "こんにちは" стало кликабельным токеном
    const token = page.locator('span[class*="wordToken"]:has-text("こんにちは")');
    await expect(token).toBeVisible({ timeout: 5000 });
  });

});
