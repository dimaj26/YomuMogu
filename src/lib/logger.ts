const fs = typeof window === 'undefined' ? require('fs') : null;
const path = typeof window === 'undefined' ? require('path') : null;

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private logDir: string;
  private logFile: string;

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
    } catch (err) {
      console.error('Не удалось инициализировать папку логов:', err);
    }
  }

  private writeToFile(level: LogLevel, message: string, errorStack?: string) {
    if (typeof window !== 'undefined' || !fs) return;
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}${errorStack ? `\nStack Trace:\n${errorStack}` : ''}\n`;
    
    try {
      fs.appendFileSync(this.logFile, logLine, 'utf8');
    } catch (err) {
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

  debug(message: string, details?: any) {
    const msg = details ? `${message} | Details: ${JSON.stringify(details)}` : message;
    console.log(this.formatConsole('DEBUG', msg));
    this.writeToFile('DEBUG', msg);
  }

  info(message: string) {
    console.log(this.formatConsole('INFO', message));
    this.writeToFile('INFO', message);
  }

  warn(message: string, details?: any) {
    const msg = details ? `${message} | Details: ${JSON.stringify(details)}` : message;
    console.warn(this.formatConsole('WARN', msg));
    this.writeToFile('WARN', msg);
  }

  error(message: string, error?: any) {
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
