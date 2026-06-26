// Условная загрузка Node-модулей только на сервере: logger изоморфен (клиент+сервер),
// а статический `import fs/path` затащил бы их в клиентский бандл и сломал сборку.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = typeof window === 'undefined' ? require('fs') : null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = typeof window === 'undefined' ? require('path') : null;

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// Ротация app.log: при достижении лимита текущий файл сдвигается в app.log.1,
// .1 → .2 и т.д., самый старый бэкап удаляется. Размер кэшируется в памяти,
// чтобы не звать statSync на каждую запись.
const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5 МБ на файл
const MAX_LOG_BACKUPS = 3; // app.log.1 .. app.log.3 (итого ≤ 20 МБ истории)

class Logger {
  private logDir: string;
  private logFile: string;
  private currentSize = 0; // байт в текущем app.log (кэш для ротации)

  constructor() {
    if (typeof window === 'undefined' && path) {
      // Будем сохранять логи в корневой папке проекта /logs
      this.logDir = path.join(process.cwd(), 'logs');
      this.logFile = path.join(this.logDir, 'app.log');
      this.initFileLogging();
    } else {
      this.logDir = '';
      this.logFile = '';
    }
  }

  private initFileLogging() {
    if (typeof window !== 'undefined' || !fs) return;
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      // Инициализируем счётчик размером уже накопленного файла (после рестарта).
      this.currentSize = fs.existsSync(this.logFile) ? fs.statSync(this.logFile).size : 0;
    } catch (err) {
      console.error('Не удалось инициализировать папку логов:', err);
    }
  }

  // Сдвигает app.log → app.log.1 → app.log.2 → ..., удаляя самый старый бэкап.
  private rotate() {
    if (!fs) return;
    try {
      const oldest = `${this.logFile}.${MAX_LOG_BACKUPS}`;
      if (fs.existsSync(oldest)) fs.unlinkSync(oldest);
      for (let i = MAX_LOG_BACKUPS - 1; i >= 1; i--) {
        const src = `${this.logFile}.${i}`;
        if (fs.existsSync(src)) fs.renameSync(src, `${this.logFile}.${i + 1}`);
      }
      if (fs.existsSync(this.logFile)) fs.renameSync(this.logFile, `${this.logFile}.1`);
      this.currentSize = 0;
    } catch {
      // Ротация не должна ронять приложение; при ошибке продолжаем писать в текущий файл.
    }
  }

  private writeToFile(level: LogLevel, message: string, errorStack?: string) {
    if (typeof window !== 'undefined' || !fs) return;
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}${errorStack ? `\nStack Trace:\n${errorStack}` : ''}\n`;
    const lineBytes = Buffer.byteLength(logLine, 'utf8');

    try {
      // Ротируем ДО записи, если строка переполнит текущий файл (пустой файл не ротируем).
      if (this.currentSize > 0 && this.currentSize + lineBytes > MAX_LOG_BYTES) {
        this.rotate();
      }
      fs.appendFileSync(this.logFile, logLine, 'utf8');
      this.currentSize += lineBytes;
    } catch {
      // Игнорируем ошибки записи, чтобы не уронить приложение из-за логов
    }
  }

  private formatConsole(level: LogLevel, message: string): string {
    const timestamp = new Date().toLocaleTimeString();
    let color = '\x1b[0m'; // Reset

    switch (level) {
      case 'INFO':
        color = '\x1b[32m'; // Green
        break;
      case 'WARN':
        color = '\x1b[33m'; // Yellow
        break;
      case 'ERROR':
        color = '\x1b[31m'; // Red
        break;
      case 'DEBUG':
        color = '\x1b[35m'; // Magenta
        break;
    }

    return `\x1b[90m[${timestamp}]\x1b[0m ${color}[${level}]\x1b[0m ${message}`;
  }

  debug(message: string, details?: unknown) {
    const msg = details ? `${message} | Details: ${JSON.stringify(details)}` : message;
    console.log(this.formatConsole('DEBUG', msg));
    this.writeToFile('DEBUG', msg);
  }

  info(message: string) {
    console.log(this.formatConsole('INFO', message));
    this.writeToFile('INFO', message);
  }

  warn(message: string, details?: unknown) {
    const msg = details ? `${message} | Details: ${JSON.stringify(details)}` : message;
    console.warn(this.formatConsole('WARN', msg));
    this.writeToFile('WARN', msg);
  }

  error(message: string, error?: unknown) {
    let errorStack = '';
    let detailsStr = '';

    if (error instanceof Error) {
      errorStack = error.stack || '';
      detailsStr = error.message;
    } else if (error) {
      detailsStr = JSON.stringify(error);
    }

    const fullMsg = detailsStr ? `${message} | Error details: ${detailsStr}` : message;
    console.error(this.formatConsole('ERROR', fullMsg));
    this.writeToFile('ERROR', fullMsg, errorStack);
  }
}

export const logger = new Logger();
