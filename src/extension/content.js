// Слушаем сообщения от фонового скрипта расширения и пересылаем их в контекст веб-страницы
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'YOMUMOGU_YT_SUBTITLES') {
    console.log('[YomuMogu Helper] Пересылка субтитров во вкладку приложения:', message);
    // Отправляем сообщение через window.postMessage, чтобы его поймал React-компонент
    window.postMessage(message, '*');
  }
});
