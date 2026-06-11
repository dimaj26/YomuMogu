import { spawn } from 'child_process';
import type { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('[E2E Global Setup] Checking MeCab tokenizer status...');
  try {
    const res = await fetch('http://127.0.0.1:8000/health');
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.status === 'ok') {
        console.log('[E2E Global Setup] MeCab tokenizer is already running.');
        return;
      }
    }
  } catch (err) {
    // Not running, proceed to start it
  }

  console.log('[E2E Global Setup] MeCab tokenizer is offline. Starting tokenizer server on port 8000...');

  // Launch MeCab server
  const child = spawn('python', [
    '-m', 'uvicorn', 'src.services.tokenizer.server:app',
    '--host', '127.0.0.1',
    '--port', '8000'
  ], {
    stdio: 'ignore',
    shell: true,
    detached: false
  });

  (globalThis as any).__mecabProcess = child;

  // Poll /health
  const start = Date.now();
  const timeout = 15000; // 15 seconds
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch('http://127.0.0.1:8000/health');
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.status === 'ok') {
          console.log('[E2E Global Setup] MeCab tokenizer started successfully.');
          return;
        }
      }
    } catch (err) {
      // wait and retry
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error('MeCab tokenizer failed to start within 15 seconds.');
}

export default globalSetup;
