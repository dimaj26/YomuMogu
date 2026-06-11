import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCachedAvailability, setCachedAvailability, getCachedTranscript, setCachedTranscript } from '../cache';
import fs from 'fs';

vi.mock('fs', () => {
  return {
    default: {
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn()
    }
  };
});

describe('YouTube Search Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('должен возвращать undefined если записи нет в кэше', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(getCachedAvailability('non-existent')).toBeUndefined();
  });

  it('должен сохранять и читать доступность', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    setCachedAvailability('vid123', true);
    expect(getCachedAvailability('vid123')).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('должен сохранять и читать транскрипты', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const mockSegments = [{ start: 0, duration: 5, text: 'Test' }];
    setCachedTranscript('vid123', mockSegments);
    expect(getCachedTranscript('vid123')).toEqual(mockSegments);
    // Запись транскрипта должна неявно устанавливать доступность в true
    expect(getCachedAvailability('vid123')).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});
