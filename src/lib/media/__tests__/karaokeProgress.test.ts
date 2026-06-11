import { describe, it, expect } from 'vitest';
import { computeFillFraction, interpolatePlayerTime } from '../karaokeProgress';

describe('computeFillFraction', () => {
  const durationMs = 2000;
  const words = [
    { text: 'こんにちは', offsetMs: 100 }, // length 5
    { text: '世界', offsetMs: 500 },     // length 2
    { text: 'テスト', offsetMs: 1000 }   // length 3
  ]; // totalChars = 10

  it('fraction=0 при t=0', () => {
    const fraction = computeFillFraction(0, durationMs, words);
    expect(fraction).toBe(0);
  });

  it('fraction=1 при t≥duration', () => {
    const fraction = computeFillFraction(2000, durationMs, words);
    expect(fraction).toBe(1);
    const fractionOver = computeFillFraction(2500, durationMs, words);
    expect(fractionOver).toBe(1);
  });

  it('точное попадание в опорные точки (char-space)', () => {
    // anchor 0: t=100 -> 0/10 = 0
    expect(computeFillFraction(100, durationMs, words)).toBe(0);
    // anchor 1: t=500 -> 5/10 = 0.5
    expect(computeFillFraction(500, durationMs, words)).toBe(0.5);
    // anchor 2: t=1000 -> 7/10 = 0.7
    expect(computeFillFraction(1000, durationMs, words)).toBe(0.7);
  });

  it('монотонность по t', () => {
    let lastFraction = -1;
    for (let t = 0; t <= durationMs; t += 50) {
      const fraction = computeFillFraction(t, durationMs, words);
      expect(fraction).toBeGreaterThanOrEqual(lastFraction);
      lastFraction = fraction;
    }
  });

  it('линейная интерполяция без words', () => {
    // t/duration
    expect(computeFillFraction(500, 2000)).toBe(0.25);
    expect(computeFillFraction(1000, 2000)).toBe(0.5);
    expect(computeFillFraction(1500, 2000)).toBe(0.75);
  });

  it('clamp вне диапазона', () => {
    expect(computeFillFraction(-500, durationMs, words)).toBe(0);
    expect(computeFillFraction(3000, durationMs, words)).toBe(1);
  });
});

describe('interpolatePlayerTime', () => {
  it('пауза замораживает время', () => {
    const lastPoll = 1.5; // в секундах
    const lastPollAtMs = 1000;
    const nowMs = 1500;
    const isPlaying = false;

    const time = interpolatePlayerTime(lastPoll, lastPollAtMs, nowMs, isPlaying);
    expect(time).toBe(1.5); // возвращается полл без изменений
  });

  it('ресинк на новом полле / расчет прошедшего времени при проигрывании', () => {
    const lastPoll = 1.5; // в секундах (1500 ms)
    const lastPollAtMs = 1000;
    const nowMs = 1100; // прошло 100 ms с момента полла
    const isPlaying = true;

    const time = interpolatePlayerTime(lastPoll, lastPollAtMs, nowMs, isPlaying);
    expect(time).toBe(1.6); // 1.5 + 0.1 сек
  });
});
