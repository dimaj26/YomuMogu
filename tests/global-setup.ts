import type { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const isDownExpected = process.env.E2E_TOKENIZER_DOWN?.trim() === '1';

  console.log(`[E2E Global Setup] Проверка статуса MeCab токенизатора (ожидается оффлайн: ${isDownExpected})...`);

  let isAlive = false;
  try {
    const res = await fetch('http://127.0.0.1:8000/health');
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.status === 'ok') {
        isAlive = true;
      }
    }
  } catch (err) {
    // Не запущен
  }

  if (isDownExpected) {
    if (isAlive) {
      throw new Error('[E2E Global Setup FAIL] Токенизатор запущен, но для теста E2E_TOKENIZER_DOWN=1 он должен быть отключен! Остановите токенизатор перед запуском этого теста.');
    }
    console.log('[E2E Global Setup] Токенизатор успешно проверен: оффлайн, как и ожидалось.');
  } else {
    if (!isAlive) {
      throw new Error('[E2E Global Setup FAIL] Токенизатор не запущен — запустите run-tokenizer.bat перед запуском E2E-тестов.');
    }
    console.log('[E2E Global Setup] Токенизатор успешно проверен: онлайн.');
  }
}

export default globalSetup;

