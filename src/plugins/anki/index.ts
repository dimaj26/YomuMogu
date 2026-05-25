import { Plugin, registerPlugin } from '../../core/pluginRegistry';
import { AnkiWordSource } from './wordSource';
import { ankiClient } from './client';

export class AnkiPlugin implements Plugin {
  name = 'AnkiConnect Plugin';
  wordSource = new AnkiWordSource();

  async init() {
    const isConnected = await ankiClient.checkConnection();
    if (isConnected) {
      console.log('[AnkiPlugin] Successfully connected to AnkiConnect');
    } else {
      console.warn('[AnkiPlugin] AnkiConnect is not available');
    }
  }
}

// Register if enabled
if (process.env.ANKI_ENABLED === 'true') {
  const plugin = new AnkiPlugin();
  registerPlugin(plugin);
}
