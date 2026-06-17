import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyCsrf } from '@/lib/csrf';
import { fetchYoutubeSearch, parseSearchResults, Candidate } from '@/lib/media/search';
import { queryExpansionService } from '@/lib/gemini/queryExpansion';
import { hasJapaneseCaptions, getYoutubeTranscriptSegments } from '@/lib/media/youtube';
import { assessSubtitleQuality, computeLevelFit, computeDurationFit, rankCandidates, ScoredCandidate, MediaTier, RANKING_PROFILES } from '@/lib/media/ranking';
import { selectPage } from '@/lib/media/selection';

export async function POST(request: NextRequest) {
  // Проверяем CSRF-защиту
  if (!verifyCsrf(request)) {
    logger.warn('[CSRF] Заблокирован неавторизованный запрос к /api/media/search');
    return NextResponse.json({ error: 'Доступ запрещен (CSRF)' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { query, excludeIds = [], seed = 42, continuation, knownWords = [], pageSize = 5 } = body;
    // Тир ранжирования под уровень пользователя (по умолчанию acquisition — прежнее поведение)
    const tier: MediaTier = (['beginner', 'bridge', 'acquisition'].includes(body.tier) ? body.tier : 'acquisition');

    // В случае продолжения пагинации поисковый запрос может быть пустым, но токен должен присутствовать
    if (!query && !continuation) {
      logger.warn('[API] Невалидный запрос к /api/media/search: отсутствуют и query, и continuation');
      return NextResponse.json(
        { error: 'Необходимо передать "query" (запрос) или "continuation" (токен)' },
        { status: 400 }
      );
    }

    logger.info(`[API] Поиск медиа. Запрос: "${query || ''}", сид: ${seed}, исключено: ${excludeIds.length} видео`);

    let jaQueries: string[] = [];
    let theme: string | null = null;
    let candidates: Candidate[] = [];
    let nextContinuation: string | null = null;

    // 1. Определение поисковых фраз (jaQueries)
    if (continuation) {
      // При продолжении пагинации запрашиваем следующую страницу напрямую по токену
      const searchRes = await fetchYoutubeSearch('', continuation);
      candidates = searchRes.candidates;
      nextContinuation = searchRes.continuation;
      logger.info(`[API] Получено ${candidates.length} кандидатов по токену продолжения`);
    } else {
      // Расширяем русский/смешанный запрос с помощью Gemini
      try {
        const expansion = await queryExpansionService.expandQuery(query);
        jaQueries = expansion.jaQueries;
        theme = expansion.theme;
        logger.info(`[API] Запрос расширен: ${JSON.stringify(jaQueries)}, тема: ${theme}`);
      } catch (err: any) {
        logger.warn(`[API] Ошибка расширения запроса Gemini: ${err.message}. Фолбэк на оригинальный запрос.`);
        jaQueries = [query];
        theme = null;
      }

      // 2. Сбор кандидатов по расширенным запросам
      // Опрашиваем YouTube по каждому японскому запросу параллельно
      const searchPromises = jaQueries.map(q => fetchYoutubeSearch(q));
      const searchResults = await Promise.all(searchPromises);

      // Объединяем пулы результатов
      const mergedCandidates: Candidate[] = [];
      const seenIds = new Set<string>();

      for (const res of searchResults) {
        for (const c of res.candidates) {
          if (!seenIds.has(c.videoId)) {
            seenIds.add(c.videoId);
            mergedCandidates.push(c);
          }
        }
        // Запоминаем continuation токен от первого успешного запроса (для пагинации)
        if (res.continuation && !nextContinuation) {
          nextContinuation = res.continuation;
        }
      }

      candidates = mergedCandidates;
      logger.info(`[API] Собрано ${candidates.length} уникальных кандидатов из YouTube по всем запросам`);
    }

    // 3. Отсекаем видео, которые уже в истории просмотров (excludeIds)
    const excludeSet = new Set<string>(excludeIds);
    let filteredCandidates = candidates.filter(c => !excludeSet.has(c.videoId));

    // 4. Локальный матчинг по заголовку и описанию для ранжирования релевантности (без LLM)
    const matchedCandidates = [...filteredCandidates].sort((a, b) => {
      const aMatch = jaQueries.some(q => a.title.toLowerCase().includes(q.toLowerCase()) || 
                                         (a.description && a.description.toLowerCase().includes(q.toLowerCase())));
      const bMatch = jaQueries.some(q => b.title.toLowerCase().includes(q.toLowerCase()) || 
                                         (b.description && b.description.toLowerCase().includes(q.toLowerCase())));
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });

    const targetScoredCount = Math.min(matchedCandidates.length, pageSize + 2);
    logger.info(`[API] Целевое количество оцененных кандидатов: ${targetScoredCount}`);

    const scoredCandidates: ScoredCandidate[] = [];

    // Обрабатываем кандидатов последовательно, чтобы избежать блокировок / 429 от YouTube
    for (const c of matchedCandidates) {
      if (scoredCandidates.length >= targetScoredCount) {
        break;
      }

      try {
        // Проверяем наличие японских субтитров
        const hasJa = await hasJapaneseCaptions(c.videoId);
        if (!hasJa) {
          continue;
        }

        // Скачиваем транскрипт
        const segments = await getYoutubeTranscriptSegments(c.videoId);
        if (!segments || segments.length === 0) {
          continue;
        }

        // Определяем тип дорожки (ASR или ручные субтитры)
        const trackKind = segments.some(s => s.words && s.words.length > 0) ? 'asr' : 'manual';

        // Токенизируем текст через микросервис MeCab
        const textToTokenize = segments.map(s => s.text).join('\n');
        const tokenizerUrl = process.env.TOKENIZER_URL || 'http://127.0.0.1:8000';
        const tokenizerApiKey = process.env.TOKENIZER_API_KEY || 'yomumogu-secret-token';
        
        let lemmas: string[] = [];
        try {
          const res = await fetch(`${tokenizerUrl}/tokenize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tokenizer-API-Key': tokenizerApiKey,
            },
            body: JSON.stringify({ text: textToTokenize }),
          });

          if (res.ok) {
            const tokenData = await res.json();
            lemmas = tokenData.lemmas || [];
          }
        } catch (e: any) {
          logger.error(`[API] Токенизация MeCab не удалась для видео ${c.videoId}: ${e.message}`);
        }

        // Рассчитываем Comprehension Rate (CR)
        const knownSet = new Set(knownWords);
        let knownCount = 0;
        for (const lemma of lemmas) {
          if (knownSet.has(lemma)) {
            knownCount++;
          }
        }

        // Дефолт для пустого текста: для acquisition — прежние 0.90, для остальных тиров — середина окна (нейтрально)
        const defaultCr = tier === 'acquisition'
          ? 0.90
          : (RANKING_PROFILES[tier].crWindow[0] + RANKING_PROFILES[tier].crWindow[1]) / 2;
        const cr = lemmas.length > 0 ? knownCount / lemmas.length : defaultCr;

        // Оцениваем качество субтитров, попадание в уровень и пригодность длины под тир
        const subQuality = assessSubtitleQuality(trackKind, segments, tier);
        const levelFit = computeLevelFit(cr, tier);
        const durationFit = computeDurationFit(c.durationSec, tier);

        scoredCandidates.push({
          candidate: c,
          trackKind,
          segments,
          cr,
          subQuality,
          levelFit,
          durationFit,
          score: 0 // Заполняется в rankCandidates
        });
      } catch (err: any) {
        logger.warn(`[API] Ошибка обработки кандидата ${c.videoId}: ${err.message || err}`);
      }
    }

    logger.info(`[API] Успешно оценено кандидатов: ${scoredCandidates.length}/${matchedCandidates.length}`);

    // 7. Скорректированное ранжирование кандидатов под тир уровня
    const rankedCandidates = rankCandidates(scoredCandidates, tier);

    // 8. Разнообразие выдачи (selection)
    const { page: selectedPage } = selectPage(
      rankedCandidates.map(r => r.candidate),
      excludeIds,
      pageSize,
      seed
    );

    // Маппим выбранные видео обратно на их ScoredCandidate объекты для возврата в UI
    const finalResults = selectedPage
      .map(p => rankedCandidates.find(sc => sc.candidate.videoId === p.videoId))
      .filter(Boolean) as ScoredCandidate[];

    return NextResponse.json({
      success: true,
      results: finalResults.map(rc => ({
        id: rc.candidate.videoId,
        title: rc.candidate.title,
        description: rc.candidate.description || '',
        url: `https://www.youtube.com/watch?v=${rc.candidate.videoId}`,
        platform: 'youtube',
        lemmas: rc.segments.flatMap(s => s.words ? s.words.map(w => w.text) : [s.text]), // Леммы транскрипта
        comprehensionRate: Math.round(rc.cr * 100),
        subQuality: rc.subQuality,
        levelFit: rc.levelFit,
        durationFit: rc.durationFit,
        score: rc.score,
        trackKind: rc.trackKind
      })),
      continuation: nextContinuation,
      theme
    });

  } catch (error: any) {
    logger.error('[API] Исключение во время поиска медиаконтента на /api/media/search', error);
    return NextResponse.json(
      { error: error.message || 'Произошла непредвиденная ошибка во время поиска на сервере' },
      { status: 500 }
    );
  }
}
