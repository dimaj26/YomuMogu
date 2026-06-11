import type { FullConfig } from '@playwright/test';
import { exec } from 'child_process';

async function globalTeardown(config: FullConfig) {
  const child = (globalThis as any).__mecabProcess;
  if (child) {
    console.log('[E2E Global Teardown] Stopping MeCab tokenizer...');
    if (process.platform === 'win32') {
      // On Windows, use taskkill to kill the process tree
      await new Promise<void>((resolve) => {
        exec(`taskkill /pid ${child.pid} /T /F`, (err) => {
          if (err) {
            console.warn('[E2E Global Teardown] Failed to taskkill child process:', err);
          }
          resolve();
        });
      });
    } else {
      child.kill('SIGTERM');
    }
    console.log('[E2E Global Teardown] MeCab tokenizer stopped.');
  }
}

export default globalTeardown;
