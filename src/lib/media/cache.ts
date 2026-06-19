import fs from 'fs';
import path from 'path';
import { logger } from '../logger';
import { SubtitleSegment } from './parser';

const CACHE_FILE_PATH = path.join(process.cwd(), '_nogit_youtube_cache.json');

interface YoutubeCacheData {
  availability: Record<string, boolean>;
  transcripts: Record<string, SubtitleSegment[]>;
}

let cacheInMemory: YoutubeCacheData = {
  availability: {},
  transcripts: {}
};

let isLoaded = false;

function loadCache() {
  if (isLoaded) return;
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const content = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      cacheInMemory = JSON.parse(content);
      logger.info(`[YouTube Cache] Успешно загружен кэш из ${CACHE_FILE_PATH}`);
    }
  } catch (err) {
    logger.error(`[YouTube Cache] Ошибка при загрузке кэша: ${err instanceof Error ? err.message : String(err)}`);
  }
  isLoaded = true;
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheInMemory, null, 2), 'utf-8');
  } catch (err) {
    logger.error(`[YouTube Cache] Ошибка при записи кэша: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function getCachedAvailability(videoId: string): boolean | undefined {
  loadCache();
  return cacheInMemory.availability[videoId];
}

export function setCachedAvailability(videoId: string, available: boolean) {
  loadCache();
  // Не перезаписываем, если значение не изменилось
  if (cacheInMemory.availability[videoId] === available) return;
  cacheInMemory.availability[videoId] = available;
  saveCache();
}

export function getCachedTranscript(videoId: string): SubtitleSegment[] | undefined {
  loadCache();
  return cacheInMemory.transcripts[videoId];
}

export function setCachedTranscript(videoId: string, segments: SubtitleSegment[]) {
  loadCache();
  cacheInMemory.transcripts[videoId] = segments;
  cacheInMemory.availability[videoId] = true;
  saveCache();
}
