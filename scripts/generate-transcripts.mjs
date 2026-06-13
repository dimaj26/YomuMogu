import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const feedPath = path.join(__dirname, '../src/resources/media_feed.json');
const transcriptsPath = path.join(__dirname, '../src/resources/media_transcripts.json');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
};

// Функция парсинга JSON3 в формат YomuMogu с пословными таймингами
function parseJson3(data) {
  const segments = [];
  if (data && Array.isArray(data.events)) {
    for (const ev of data.events) {
      if (!ev.segs) continue;
      
      const text = ev.segs.map(s => s.utf8).join('').trim();
      if (!text) continue;

      const words = ev.segs.map(s => ({
        text: s.utf8,
        offsetMs: s.tOffsetMs || 0
      }));

      segments.push({
        start: ev.tStartMs / 1000,
        duration: (ev.dDurationMs || 0) / 1000,
        text: text,
        words: words
      });
    }
  }
  return segments;
}

async function scrapeVideo(videoId) {
  console.log(`[Скрейпер] Начинаем загрузку видео ${videoId}...`);
  
  // 1. Запрос watch-страницы для получения cookies
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=ja`;
  const watchRes = await fetch(watchUrl, { headers });
  if (!watchRes.ok) {
    throw new Error(`Не удалось загрузить страницу watch: ${watchRes.statusText}`);
  }
  await watchRes.text();

  const setCookies = watchRes.headers.getSetCookie ? watchRes.headers.getSetCookie() : [];
  const cookieString = setCookies
    .map(c => c.split(';')[0])
    .join('; ');

  // 2. Запрос к player API
  const innerTubeKey = process.env.YOUTUBE_INNERTUBE_KEY || '';
  const playerUrl = `https://www.youtube.com/youtubei/v1/player?key=${innerTubeKey}`;
  const playerRes = await fetch(playerUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Cookie': cookieString
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '20.10.38'
        }
      },
      videoId: videoId
    })
  });

  if (!playerRes.ok) {
    throw new Error(`Не удалось вызвать player API: ${playerRes.statusText}`);
  }

  const playerJson = await playerRes.json();
  const tracks = playerJson?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) {
    throw new Error('У этого видео нет доступных дорожек субтитров');
  }

  // Приоритизируем ручные японские субтитры (ja), затем автогенерируемые
  const jaTrack = tracks.find(t => t.languageCode === 'ja' && t.kind !== 'asr') ||
                  tracks.find(t => t.languageCode === 'ja' || t.languageCode?.startsWith('ja') || t.vssId?.includes('.ja'));

  if (!jaTrack) {
    throw new Error('Японская дорожка субтитров (ja) не найдена');
  }

  console.log(`[Скрейпер] Найдена японская дорожка: ${jaTrack.name?.simpleText || 'Японский'}`);

  // 3. Запрос timedtext в формате JSON3
  const timedtextParsed = new URL(jaTrack.baseUrl);
  timedtextParsed.searchParams.set('fmt', 'json3');
  const timedtextUrl = timedtextParsed.toString();

  const timedtextRes = await fetch(timedtextUrl, {
    headers: {
      ...headers,
      'Cookie': cookieString
    }
  });


  if (!timedtextRes.ok) {
    throw new Error(`Не удалось загрузить timedtext JSON3: ${timedtextRes.statusText}`);
  }

  const timedtextData = await timedtextRes.json();
  const segments = parseJson3(timedtextData);
  if (segments.length === 0) {
    throw new Error('Не удалось спарсить ни одного сегмента из JSON3');
  }

  console.log(`[Скрейпер] Видео ${videoId}: успешно получено ${segments.length} сегментов субтитров`);
  return segments;
}

async function run() {
  console.log('[Генератор] Чтение media_feed.json...');
  const feedContent = fs.readFileSync(feedPath, 'utf-8');
  const feed = JSON.parse(feedContent);

  const newTranscripts = {};

  for (const item of feed) {
    if (item.platform !== 'youtube') continue;
    const videoId = item.url.split('v=')[1]?.split('&')[0] || '';
    if (!videoId) {
      console.warn(`[Предупреждение] Не удалось получить ID для видео: ${item.title}`);
      continue;
    }

    try {
      const segments = await scrapeVideo(videoId);
      newTranscripts[videoId] = {
        generatedAt: new Date().toISOString(),
        segments: segments
      };
    } catch (err) {
      // Правило Prime Directive: в случае любой ошибки скрейпинга логируем её и пропускаем
      console.error(`[КРИТИЧЕСКАЯ ОШИБКА] Не удалось получить субтитры для "${item.title}" (${videoId}): ${err.message}`);
      console.error('[ВНИМАНИЕ] Пропускаем эту запись, чтобы избежать генерации фальшивых данных.');
    }
  }

  console.log('[Генератор] Запись новых транскриптов в media_transcripts.json...');
  fs.writeFileSync(transcriptsPath, JSON.stringify(newTranscripts, null, 2), 'utf-8');
  console.log('[Генератор] Завершено успешно!');
}

// Запуск с выключенной верификацией SSL (если задано)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

run().catch(err => {
  console.error('[Фатальная ошибка]', err);
  process.exit(1);
});
