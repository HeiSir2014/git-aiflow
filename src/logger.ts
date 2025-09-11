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
  consoleLevel: LogLevel;
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
  consoleLevel: LogLevel.INFO,
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
        logMessage += `\n${JSON.stringify(meta, null, 0)}`;
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
        level: config.consoleLevel,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({
            format: 'HH:mm:ss'
          }),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            let consoleMessage = `${timestamp} ${level}: ${message}`;

            // Add metadata if present (but keep it concise for console)
            if (Object.keys(meta).length > 0) {
              const metaStr = JSON.stringify(meta);
              if (metaStr.length < 100) {
                consoleMessage += ` ${metaStr}`;
              }
              else {
                consoleMessage += ` ${metaStr.substring(0, 100)}...`;
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
 * Cache for caller information to improve performance
 */
const callerCache = new Map<string, string>();

/**
 * Get caller information from stack trace
 */
function getCallerInfo(): string {
  // Create a simple stack key for caching
  const stackKey = new Error().stack?.split('\n').slice(3, 6).join('|') || '';

  // Check cache first
  if (callerCache.has(stackKey)) {
    return callerCache.get(stackKey)!;
  }

  const originalPrepareStackTrace = Error.prepareStackTrace;
  const originalStackTraceLimit = Error.stackTraceLimit;

  try {
    Error.prepareStackTrace = (_, stack) => stack;
    Error.stackTraceLimit = 20;

    const stack = new Error().stack as any;

    // Skip the first 3 frames: Error, getCallerInfo, and the logger method
    for (let i = 3; i < stack.length; i++) {
      const frame = stack[i];
      const fileName = frame.getFileName();
      // const functionName = frame.getFunctionName();
      // const methodName = frame.getMethodName();
      // const typeName = frame.getTypeName();

      // Skip logger.ts, node_modules, and internal files
      if (fileName &&
        !fileName.includes('/logger.ts') &&
        !fileName.includes('/logger.js') &&
        !fileName.includes('node_modules') &&
        !fileName.includes('internal/') &&
        !fileName.includes('/util.js') &&
        !fileName.includes('/util.ts')
      ) {

        // Extract filename without path and extension
        const baseName = path.basename(fileName, path.extname(fileName));

        // Try to construct a meaningful context
        let context = baseName.toUpperCase().trim();

        // If we have a type name (class name), use it
        // if (typeName && 
        //     typeName !== 'Object' && 
        //     typeName !== 'Function' && 
        //     typeName !== 'Module' &&
        //     typeName !== '') {
        //   context = typeName;

        //   // Add method name if available
        //   if (methodName && methodName !== 'anonymous' && methodName !== '') {
        //     context += `.${methodName}`;
        //   } else if (functionName && functionName !== 'anonymous' && functionName !== '') {
        //     context += `.${functionName}`;
        //   }
        // } else if (functionName && functionName !== 'anonymous' && functionName !== '') {
        //   // Use function name if no class name
        //   context = `${baseName}.${functionName}`;
        // } else if (methodName && methodName !== 'anonymous' && methodName !== '') {
        //   // Use method name if available
        //   context = `${baseName}.${methodName}`;
        // }

        // Cache the result
        callerCache.set(stackKey, context);
        return context;
      }
    }

    const fallback = 'Unknown';
    callerCache.set(stackKey, fallback);
    return fallback;
  } catch (error) {
    const fallback = 'Unknown';
    callerCache.set(stackKey, fallback);
    return fallback;
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
    Error.stackTraceLimit = originalStackTraceLimit;
  }
}

/**
 * Logger class with convenient methods
 */
export class Logger {
  private static instance: Logger | null = null;
  private winston: winston.Logger;

  private constructor(config?: Partial<LoggerConfig>) {
    this.winston = createWinstonLogger({ ...defaultConfig, ...config });
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    } else if (config) {
      // If config is provided and instance exists, recreate with new config
      Logger.instance.winston = createWinstonLogger({ ...defaultConfig, ...config });
    }
    return Logger.instance;
  }

  /**
   * Create logger for specific context (deprecated, use getInstance instead)
   */
  static create(_context: string, config?: Partial<LoggerConfig>): Logger {
    console.warn('Logger.create() is deprecated, use Logger.getInstance() instead');
    return Logger.getInstance(config);
  }

  /**
   * Configure global logger settings
   */
  static configure(config: Partial<LoggerConfig>): void {
    Object.assign(defaultConfig, config);
    // Recreate logger with new config
    if (Logger.instance) {
      Logger.instance.winston = createWinstonLogger({ ...defaultConfig, ...config });
    }
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static reset(): void {
    Logger.instance = null;
  }

  /**
   * Check if singleton instance exists
   */
  static hasInstance(): boolean {
    return Logger.instance !== null;
  }

  /**
   * Clear caller cache (useful for testing or memory management)
   */
  static clearCache(): void {
    callerCache.clear();
  }

  /**
   * Get cache size (for debugging)
   */
  static getCacheSize(): number {
    return callerCache.size;
  }

  private formatMessage(message: string): string {
    const context = getCallerInfo();
    return `[${context}] ${message}`;
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
 * Default logger instance (singleton)
 */
export const logger = Logger.getInstance();


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

/**
 * Test function to verify stack trace parsing
 * This can be removed in production
 */
export function testLoggerContext(): void {
  logger.info('Testing logger context detection');
  logger.debug('This should show the calling context');
  logger.error('Error test with context');
}
