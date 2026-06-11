import { describe, it, expect } from 'vitest';
import mediaFeed from '../../../resources/media_feed.json';

describe('Feed Language Integration', () => {
  it('каждое видео фида имеет настоящую ja-дорожку субтитров', async (context) => {
    try {
      // Проверяем доступность YouTube, чтобы отловить 429
      const testRes = await fetch('https://www.youtube.com/watch?v=Jnea4HbYIso&hl=ja');
      if (testRes.status === 429) {
        console.warn('Skipping integration test: YouTube IP rate-limit (429)');
        context.skip();
        return;
      }
    } catch (e) {}

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    };

    for (const item of mediaFeed) {
      if (item.platform !== 'youtube') continue;

      const videoId = item.url.split('v=')[1]?.split('&')[0] || '';
      expect(videoId).not.toBe('');

      const pageUrl = `https://www.youtube.com/watch?v=${videoId}&hl=ja`;
      let response;
      try {
        response = await fetch(pageUrl, { headers });
        if (response.status === 429) {
          console.warn('Skipping integration test due to YouTube 429 IP rate-limit during execution');
          context.skip();
          return;
        }
      } catch (err: any) {
        throw new Error(`Не удалось загрузить страницу YouTube для видео ${videoId}: ${err.message}`);
      }
      expect(response.status).toBe(200);
      const html = await response.text();

      // Находим captionTracks в разметке страницы
      const captionTracksMatch = html.match(/"captionTracks":\s*(\[[^\]]+\])/);
      let tracks: any[] = [];
      if (captionTracksMatch) {
        try {
          tracks = JSON.parse(captionTracksMatch[1]);
        } catch (e) {}
      }

      // Если в captionTracks нет, пробуем искать в ytInitialPlayerResponse
      if (tracks.length === 0) {
        const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/);
        if (playerResponseMatch) {
          try {
            const playerResponse = JSON.parse(playerResponseMatch[1]);
            tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
          } catch (e) {}
        }
      }

      // Ищем дорожку с languageCode === 'ja'
      const hasJaTrack = tracks.some(t => t.languageCode === 'ja' || t.languageCode?.startsWith('ja') || t.vssId?.includes('.ja'));

      expect(hasJaTrack, `Видео "${item.title}" (${videoId}) не имеет оригинальной или ручной японской дорожки субтитров (ja)`).toBe(true);
    }
  });
});
