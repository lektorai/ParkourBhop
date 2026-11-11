import type { CapacitorConfig } from '@capacitor/cli';
import { APP_ID, APP_NAME } from './src/config/app';

/** Android-сборка для RuStore: все файлы игры лежат внутри приложения, игра работает офлайн. */
const config: CapacitorConfig = {
  appId: APP_ID,
  appName: APP_NAME,
  webDir: 'dist/rustore',
  android: {
    backgroundColor: '#F3E6CF',
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    // Android 15+ рисует приложение под системными панелями: оставляем под них отступы.
    adjustMarginsForEdgeToEdge: 'auto',
  },
};

export default config;
