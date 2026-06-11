import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { logger } from '@/lib/logger';

const execFileAsync = promisify(execFile);

const PYTHON_PATH = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
const LOOKUP_SCRIPT_PATH = path.join(process.cwd(), 'src', 'lib', 'dict', 'lookup.py');

export interface JitenDexResult {
  word: string;
  entry?: string;
  definition?: string;
  error?: string;
}

/**
 * Выполняет поиск слова во встроенном словаре JitenDex.
 * Вызывает вспомогательный Python-скрипт lookup.py.
 */
export async function lookupWord(word: string): Promise<JitenDexResult> {
  if (!fs.existsSync(PYTHON_PATH)) {
    const errorMsg = 'venv не найден — запустите run-tokenizer.bat для bootstrap';
    logger.error(`[JitenDex] Ошибка: ${errorMsg}`);
    return {
      word,
      error: errorMsg,
    };
  }

  try {
    const { stdout } = await execFileAsync(PYTHON_PATH, [LOOKUP_SCRIPT_PATH, word], {
      encoding: 'utf8',
    });
    return JSON.parse(stdout) as JitenDexResult;
  } catch (error: any) {
    return {
      word,
      error: error.message || String(error),
    };
  }
}

