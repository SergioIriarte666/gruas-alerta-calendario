import { createLogger } from "@/lib/logger";

const logger = createLogger("logger");
/**
 * Smart logging system that only works in development
 * Replaces all console.logs for better performance in production
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  enabled: boolean;
  level: LogLevel;
  modules: Record<string, boolean>;
}

const config: LogConfig = {
  enabled: import.meta.env.DEV,
  level: 'debug',
  modules: {}
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

class Logger {
  private moduleName: string;

  constructor(moduleName: string = 'default') {
    this.moduleName = moduleName;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!config.enabled) return level === 'error'; // Only errors in production
    if (config.modules[this.moduleName] === false) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): [string, ...any[]] {
    const timestamp = new Date().toISOString().substr(11, 12);
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.moduleName}]`;
    return [`${prefix} ${message}`, ...args];
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      logger.debug(...this.formatMessage('debug', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(...this.formatMessage('info', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      logger.warn(...this.formatMessage('warn', message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      logger.error(...this.formatMessage('error', message, ...args));
    }
  }

  group(label: string): void {
    if (config.enabled) {
      console.group(`[${this.moduleName}] ${label}`);
    }
  }

  groupEnd(): void {
    if (config.enabled) {
      console.groupEnd();
    }
  }
}

// Global logger configuration
export const configureLogger = (newConfig: Partial<LogConfig>): void => {
  Object.assign(config, newConfig);
};

// Enable/disable specific modules
export const setModuleLogging = (moduleName: string, enabled: boolean): void => {
  config.modules[moduleName] = enabled;
};

// Create logger for specific module
export const createLogger = (moduleName: string): Logger => {
  return new Logger(moduleName);
};

// Default logger
export const logger = new Logger('app');