import { describe, it, expect } from 'vitest';
import { fetchYoutubeSearch } from '../search';
import { hasJapaneseCaptions } from '../youtube';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('YouTube Search Live Integration', () => {
  it('реальный поиск по японскому запросу возвращает кандидатов с субтитрами', async () => {
    // Делаем реальный поиск по японскому запросу
    const { candidates, continuation } = await fetchYoutubeSearch('日本語の勉強');
    
    expect(candidates.length).toBeGreaterThan(0);
    expect(continuation).toBeDefined();
    
    // Проверим, что хотя бы для одного из первых 3 кандидатов доступны японские субтитры
    let foundJaSubtitles = false;
    const topCandidates = candidates.slice(0, 3);
    
    for (const c of topCandidates) {
      const hasJa = await hasJapaneseCaptions(c.videoId);
      if (hasJa) {
        foundJaSubtitles = true;
        break;
      }
    }
    
    expect(foundJaSubtitles).toBe(true);
  });
});
