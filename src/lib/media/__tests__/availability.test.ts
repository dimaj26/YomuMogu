import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkMediaAvailability } from '../availability';

describe('Media Availability', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('возвращает true, если YouTube oEmbed возвращает 200', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
    } as Response);

    const result = await checkMediaAvailability({
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=validId1234',
    });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=validId1234'
    );
  });

  it('возвращает false, если YouTube oEmbed возвращает не-200', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      status: 404,
      ok: false,
    } as Response);

    const result = await checkMediaAvailability({
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=invalidId12',
    });

    expect(result).toBe(false);
  });

  it('возвращает false, если не удалось извлечь ID видео YouTube', async () => {
    const result = await checkMediaAvailability({
      platform: 'youtube',
      url: 'https://invalid-url.com',
    });

    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('возвращает false, если платформа не поддерживается', async () => {
    const result = await checkMediaAvailability({
      platform: 'unknown_platform',
      url: 'https://example.com/audio.mp3',
    });

    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('возвращает false при ошибке fetch', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await checkMediaAvailability({
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=validId1234',
    });

    expect(result).toBe(false);
  });
});
