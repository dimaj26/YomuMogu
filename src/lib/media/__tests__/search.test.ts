import { describe, it, expect } from 'vitest';
import { parseSearchResults } from '../search';
import nihongoFixture from './fixtures/nihongo.json';
import conversationFixture from './fixtures/conversation.json';

describe('YouTube Search Parser', () => {
  it('парсер извлекает videoId/title/channel из реального фикстурного ответа (nihongo)', () => {
    const { candidates, continuation } = parseSearchResults(nihongoFixture);
    expect(candidates.length).toBeGreaterThan(0);
    
    const first = candidates[0];
    expect(first.videoId).toBe('Nqv0xOu-4oM');
    expect(first.title).toContain('日本語の勉強');
    expect(first.channel).toBe('あかね的日本語教室');
    expect(first.durationSec).toBe(672);
    expect(first.description).toContain('SUPER REAL JAPANESE');
    
    expect(continuation).toBeDefined();
    expect(typeof continuation).toBe('string');
  });

  it('парсер извлекает videoId/title/channel из реального фикстурного ответа (conversation)', () => {
    const { candidates, continuation } = parseSearchResults(conversationFixture);
    expect(candidates.length).toBeGreaterThan(0);
    expect(continuation).toBeDefined();
  });

  it('неизвестный формат ответа → пустой массив + без исключений', () => {
    const { candidates, continuation } = parseSearchResults({});
    expect(candidates).toEqual([]);
    expect(continuation).toBeNull();

    const { candidates: candidatesNull, continuation: continuationNull } = parseSearchResults(null);
    expect(candidatesNull).toEqual([]);
    expect(continuationNull).toBeNull();
  });
});
