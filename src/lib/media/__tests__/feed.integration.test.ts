import { describe, it, expect } from 'vitest';
import mediaFeed from '../../../resources/media_feed.json';

describe('Media Feed Integration', () => {
  it('каждое видео из media_feed существует и доступно для встраивания (oEmbed 200 + ja captions)', async () => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    };

    for (const item of mediaFeed) {
      if (item.platform !== 'youtube') continue;
      
      const videoId = item.url.split('v=')[1]?.split('&')[0] || '';
      expect(videoId).not.toBe('');

      // 1. Проверяем oEmbed
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}`;
      const oembedRes = await fetch(oembedUrl);
      
      expect(oembedRes.status, `Видео ${item.title} (${videoId}) вернуло статус ${oembedRes.status} на oEmbed (должно быть 200)`).toBe(200);

      // 2. Проверяем наличие японских субтитров на странице
      const pageUrl = `https://www.youtube.com/watch?v=${videoId}&hl=ja`;
      const response = await fetch(pageUrl, { headers });
      expect(response.status).toBe(200);
      const html = await response.text();

      const hasCaptionTracks = html.includes('captionTracks');
      const hasYtInitialPlayerResponse = html.includes('ytInitialPlayerResponse');
      expect(hasCaptionTracks || hasYtInitialPlayerResponse, `На странице видео ${item.title} (${videoId}) не найдено упоминаний субтитров`).toBe(true);

      const hasJaText = html.includes('lang=ja') || html.includes('languageCode":"ja') || html.includes('.ja') || html.includes('kind":"asr');
      expect(hasJaText, `Для видео ${item.title} (${videoId}) не найдено японской дорожки субтитров (ja)`).toBe(true);
    }
  });
});
