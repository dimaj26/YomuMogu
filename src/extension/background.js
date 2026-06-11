import { convertJson3ToSegments } from './convert.js';

// Перехват запросов к API субтитров YouTube и трансляция их в веб-приложение YomuMogu
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    // Проверяем, что запрос сделан из конкретной вкладки браузера
    if (details.tabId < 0) return;

    try {
      const urlObj = new URL(details.url);
      
      // Предотвращаем рекурсивный перехват собственного fetch-запроса расширения
      if (urlObj.searchParams.get('fmt') === 'json3' && urlObj.searchParams.get('client') === 'yomumogu') {
        return;
      }

      // Принудительно запрашиваем субтитры в удобном JSON-формате (json3)
      urlObj.searchParams.set('fmt', 'json3');
      // Помечаем запрос как отправленный расширением, чтобы избежать зацикливания
      urlObj.searchParams.set('client', 'yomumogu');
      const jsonUrl = urlObj.toString();

      console.log(`[YomuMogu Helper] Перехвачен URL субтитров. Загрузка JSON версии: ${jsonUrl}`);

      const response = await fetch(jsonUrl);
      if (!response.ok) {
        throw new Error(`Не удалось загрузить субтитры: статус ${response.status}`);
      }

      const data = await response.json();
      const segments = convertJson3ToSegments(data);

      if (segments.length > 0) {
        const videoId = urlObj.searchParams.get('v');
        console.log(`[YomuMogu Helper] Успешно распознано сегментов для видео ${videoId}: ${segments.length}`);

        const message = {
          type: 'YOMUMOGU_YT_SUBTITLES',
          videoId,
          segments
        };

        // Отправляем во вкладку-источник запроса (keep origin-tab path)
        chrome.tabs.sendMessage(details.tabId, message, () => {
          const err = chrome.runtime.lastError;
          if (err) {
            console.debug(`[YomuMogu Helper] Ошибка отправки на вкладку-источник: ${err.message}`);
          }
        });

        // Также транслируем во все открытые вкладки приложения YomuMogu
        chrome.tabs.query({
          url: [
            "http://localhost:3000/*",
            "http://127.0.0.1:3000/*",
            "https://localhost:3000/*",
            "https://127.0.0.1:3000/*"
          ]
        }, (tabs) => {
          if (!tabs) return;
          for (const tab of tabs) {
            // Не отправляем повторно во вкладку-источник
            if (tab.id === details.tabId) continue;
            chrome.tabs.sendMessage(tab.id, message, () => {
              const err = chrome.runtime.lastError;
              if (err) {
                console.debug(`[YomuMogu Helper] Ошибка отправки на вкладку приложения ${tab.id}: ${err.message}`);
              }
            });
          }
        });
      }
    } catch (err) {
      console.error('[YomuMogu Helper] Ошибка при обработке субтитров YouTube:', err);
    }
  },
  { urls: ["https://*.youtube.com/api/timedtext*"] }
);
