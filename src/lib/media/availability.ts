import { extractYoutubeVideoId } from './youtube';
import { logger } from '../logger';

export interface MediaAvailabilityItem {
  url: string;
  platform: string;
}

type AvailabilityStrategy = (url: string) => Promise<boolean>;

const availabilityStrategies: Record<string, AvailabilityStrategy> = {
  youtube: async (url: string): Promise<boolean> => {
    const videoId = extractYoutubeVideoId(url);
    if (!videoId) {
      logger.warn(`[Media Availability] Не удалось извлечь ID видео YouTube из URL: ${url}`);
      return false;
    }
    
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}`;
    try {
      const response = await fetch(oembedUrl);
      if (response.status === 200) {
        return true;
      }
      logger.warn(`[Media Availability] Видео YouTube ${videoId} недоступно через oEmbed, статус: ${response.status}`);
      return false;
    } catch (error) {
      logger.error(`[Media Availability] Ошибка при проверке oEmbed для видео ${videoId}:`, error);
      return false;
    }
  }
};

/**
 * Проверяет доступность медиа-ресурса по его платформе и URL
 */
export async function checkMediaAvailability(item: MediaAvailabilityItem): Promise<boolean> {
  const strategy = availabilityStrategies[item.platform];
  if (!strategy) {
    logger.warn(`[Media Availability] Неизвестная или неподдерживаемая платформа: ${item.platform}`);
    return false;
  }
  
  return strategy(item.url);
}
