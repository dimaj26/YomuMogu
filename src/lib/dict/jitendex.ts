import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const PYTHON_PATH = 'python';
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
