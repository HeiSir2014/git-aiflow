import winston from 'winston';
import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly'
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  maxSize: string;
  maxFiles: number;
  logDir: string;
  enableConsole: boolean;
}

/**
 * Get global logs directory based on platform
 */
function getGlobalLogsDir(): string {
  const platform = os.platform();
  
  if (platform === 'win32') {
    // Windows: %APPDATA%\aiflow\logs
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'aiflow', 'logs');
  } else {
    // Unix-like: ~/.config/aiflow/logs or ~/logs/aiflow
    const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    return path.join(configDir, 'aiflow', 'logs');
  }
}

/**
 * Ensure logs directory exists
 */
function ensureLogsDir(logDir: string): void {
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (error) {
    console.warn(`Failed to create logs directory ${logDir}:`, error);
  }
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
  level: LogLevel.DEBUG,
  maxSize: '10m',      // 10MB per file
  maxFiles: 5,         // Keep 5 files
  logDir: getGlobalLogsDir(),
  enableConsole: true
};

/**
 * Create Winston logger instance
 */
function createWinstonLogger(config: LoggerConfig = defaultConfig): winston.Logger {
  // Ensure log directory exists
  ensureLogsDir(config.logDir);

  const logFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
      let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
      
      // Add stack trace for errors
      if (stack) {
        logMessage += `\n${stack}`;
      }
      
      // Add metadata if present
      if (Object.keys(meta).length > 0) {
        logMessage += `\n${JSON.stringify(meta, null, 2)}`;
      }
      
      return logMessage;
    })
  );

  const transports: winston.transport[] = [];

  // File transport with rotation
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logDir, 'aiflow.log'),
      level: config.level,
      format: logFormat,
      maxsize: parseSize(config.maxSize),
      maxFiles: config.maxFiles,
      tailable: true
    })
  );

  // Error-only file transport
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logDir, 'error.log'),
      level: LogLevel.ERROR,
      format: logFormat,
      maxsize: parseSize(config.maxSize),
      maxFiles: config.maxFiles,
      tailable: true
    })
  );

  // Console transport (conditional)
  if (config.enableConsole) {
    transports.push(
      new winston.transports.Console({
        level: config.level,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
          }),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            let consoleMessage = `${timestamp} ${level}: ${message}`;
            
            // Add metadata if present (but keep it concise for console)
            if (Object.keys(meta).length > 0) {
              const metaStr = JSON.stringify(meta);
              if (metaStr.length < 100) {
                consoleMessage += ` ${metaStr}`;
              }
            }
            
            return consoleMessage;
          })
        )
      })
    );
  }

  return winston.createLogger({
    level: config.level,
    transports,
    exitOnError: false,
    silent: false
  });
}

/**
 * Parse size string to bytes
 */
function parseSize(sizeStr: string): number {
  const size = parseFloat(sizeStr);
  const unit = sizeStr.toLowerCase().slice(-1);
  
  switch (unit) {
    case 'k': return size * 1024;
    case 'm': return size * 1024 * 1024;
    case 'g': return size * 1024 * 1024 * 1024;
    default: return size;
  }
}

/**
 * Logger class with convenient methods
 */
export class Logger {
  private winston: winston.Logger;
  private context: string;

  constructor(context: string = 'App', config?: Partial<LoggerConfig>) {
    this.context = context;
    this.winston = createWinstonLogger({ ...defaultConfig, ...config });
  }

  /**
   * Create logger for specific context
   */
  static create(context: string, config?: Partial<LoggerConfig>): Logger {
    return new Logger(context, config);
  }

  /**
   * Configure global logger settings
   */
  static configure(config: Partial<LoggerConfig>): void {
    Object.assign(defaultConfig, config);
  }

  private formatMessage(message: string): string {
    return `[${this.context}] ${message}`;
  }

  error(message: string, error?: Error | any): void {
    if (error instanceof Error) {
      this.winston.error(this.formatMessage(message), { error: error.message, stack: error.stack });
    } else if (error) {
      this.winston.error(this.formatMessage(message), { error });
    } else {
      this.winston.error(this.formatMessage(message));
    }
  }

  warn(message: string, meta?: any): void {
    this.winston.warn(this.formatMessage(message), meta);
  }

  info(message: string, meta?: any): void {
    this.winston.info(this.formatMessage(message), meta);
  }

  http(message: string, meta?: any): void {
    this.winston.http(this.formatMessage(message), meta);
  }

  verbose(message: string, meta?: any): void {
    this.winston.verbose(this.formatMessage(message), meta);
  }

  debug(message: string, meta?: any): void {
    this.winston.debug(this.formatMessage(message), meta);
  }

  silly(message: string, meta?: any): void {
    this.winston.silly(this.formatMessage(message), meta);
  }

  /**
   * Log shell command execution
   */
  shell(command: string, result?: string, error?: Error): void {
    if (error) {
      this.error(`Shell command failed: ${command}`, error);
    } else {
      this.debug(`Shell command: ${command}`, { result: result?.substring(0, 200) });
    }
  }

  /**
   * Log HTTP request/response
   */
  httpRequest(method: string, url: string, status?: number, duration?: number): void {
    this.http(`${method} ${url}`, { status, duration });
  }

  /**
   * Log service operations
   */
  service(operation: string, service: string, meta?: any): void {
    this.info(`${service}: ${operation}`, meta);
  }

  /**
   * Get underlying Winston instance
   */
  getWinston(): winston.Logger {
    return this.winston;
  }
}

/**
 * Default logger instance
 */
export const logger = Logger.create('AIFlow');

/**
 * Create context-specific logger
 */
export function createLogger(context: string, config?: Partial<LoggerConfig>): Logger {
  return Logger.create(context, config);
}

/**
 * Configure global logging
 */
export function configureLogging(config: Partial<LoggerConfig>): void {
  Logger.configure(config);
}

/**
 * Get the global logs directory path
 */
export function getLogsDir(): string {
  return getGlobalLogsDir();
}
