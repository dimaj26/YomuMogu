// Перехват запросов к API субтитров YouTube и трансляция их в веб-приложение YomuMogu
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    // Проверяем, что запрос сделан из конкретной вкладки браузера
    if (details.tabId < 0) return;

    try {
      const urlObj = new URL(details.url);
      // Принудительно запрашиваем субтитры в удобном JSON-формате (json3)
      urlObj.searchParams.set('fmt', 'json3');
      const jsonUrl = urlObj.toString();

      console.log(`[YomuMogu Helper] Перехвачен URL субтитров. Загрузка JSON версии: ${jsonUrl}`);

      const response = await fetch(jsonUrl);
      if (!response.ok) {
        throw new Error(`Не удалось загрузить субтитры: статус ${response.status}`);
      }

      const data = await response.json();
      const segments = [];

      // Форматируем в структуру SubtitleSegment[]
      if (data && Array.isArray(data.events)) {
        for (const ev of data.events) {
          if (!ev.segs) continue;
          const text = ev.segs.map(s => s.utf8).join('').trim();
          if (!text) continue;

          segments.push({
            start: ev.tStartMs / 1000,
            duration: (ev.dDurationMs || 0) / 1000,
            text: text
          });
        }
      }

      if (segments.length > 0) {
        console.log(`[YomuMogu Helper] Успешно распознано сегментов: ${segments.length}. Отправка во вкладку ${details.tabId}`);
        // Передаем данные во вкладку, инициировавшую запрос
        chrome.tabs.sendMessage(details.tabId, {
          type: 'YOMUMOGU_YT_SUBTITLES',
          segments
        }, () => {
          // Игнорируем возможные ошибки неактивности скрипта на вкладке
          const err = chrome.runtime.lastError;
          if (err) {
            console.debug(`[YomuMogu Helper] Ошибка отправки сообщения (возможно, вкладка обновляется): ${err.message}`);
          }
        });
      }
    } catch (err) {
      console.error('[YomuMogu Helper] Ошибка при обработке субтитров YouTube:', err);
    }
  },
  { urls: ["https://*.youtube.com/api/timedtext*"] }
);
