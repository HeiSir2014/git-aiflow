import winston from 'winston';
import path from 'path';
import fs from 'fs';
import os from 'os';

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
  /** Buffer size for file writes (bytes) */
  bufferSize: number;
  /** Auto-flush interval (milliseconds) */
  flushInterval: number;
  /** Enable lazy file creation */
  lazy: boolean;
  /** High water mark for streams */
  highWaterMark: number;
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
  enableConsole: true,
  bufferSize: 64 * 1024,  // 64KB buffer for better performance
  flushInterval: 0,       // Disable auto-flush to avoid blocking (was 5000)
  lazy: false,           // Create files immediately (was true)
  highWaterMark: 16 * 1024 // 16KB high water mark
};

/**
 * Create Winston logger instance
 */
function createWinstonLogger(config: LoggerConfig = defaultConfig): winston.Logger {
  // Ensure log directory exists
  ensureLogsDir(config.logDir);

  const logFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
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
      tailable: true,
      lazy: config.lazy
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
      tailable: true,
      lazy: config.lazy
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
            format: 'HH:mm:ss.SSS'
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

  const logger = winston.createLogger({
    level: config.level,
    transports,
    exitOnError: false,
    silent: false
  });

  // Set up periodic flush for better write performance balance
  if (config.flushInterval > 0) {
    const flushTimer = setInterval(() => {
      try {
        logger.transports.forEach(transport => {
          if (transport instanceof winston.transports.File) {
            // Force flush file transports safely
            const stream = (transport as any)._stream;
            if (stream && stream.writable && typeof stream.flush === 'function') {
              // Use setImmediate to avoid blocking
              setImmediate(() => {
                try {
                  stream.flush();
                } catch (error) {
                  // Ignore flush errors to prevent crashes
                }
              });
            }
          }
        });
      } catch (error) {
        // Ignore timer errors to prevent crashes
      }
    }, config.flushInterval);

    // Store timer for cleanup and make it not block process exit
    flushTimer.unref();
    (logger as any).flushTimer = flushTimer;
  }

  return logger;
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
  static shutdownLogger: (() => Promise<void>) | null = null;
  private winston: winston.Logger;
  private isShuttingDown: boolean = false;

  private constructor(config?: Partial<LoggerConfig>) {
    this.winston = createWinstonLogger({ ...defaultConfig, ...config });
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);

      // Store shutdown function as static method
      Logger.shutdownLogger = async function() {
        if (!Logger.hasInstance()) return;
        const loggerInstance = Logger.getInstance();
        const winstonLogger = loggerInstance.getWinston();

        // Mark as shutting down to prevent new logs
        loggerInstance.isShuttingDown = true;

        // Clear flush timer if exists
        const flushTimer = (winstonLogger as any).flushTimer;
        if (flushTimer) {
          clearInterval(flushTimer);
        }

        // Final flush before closing (with timeout)
        const flushPromises = winstonLogger.transports.map(transport => {
          return new Promise<void>(resolve => {
            if (transport instanceof winston.transports.File) {
              const stream = (transport as any)._stream;
              if (stream && stream.writable && typeof stream.flush === 'function') {
                try {
                  stream.flush();
                } catch (error) {
                  // Ignore flush errors
                }
              }
            }
            resolve();
          });
        });

        // Wait for flush with timeout
        await Promise.race([
          Promise.all(flushPromises),
          new Promise<void>(resolve => setTimeout(resolve, 1000)) // 1 second timeout
        ]);

        // Close all transports gracefully with timeout
        const closePromises = winstonLogger.transports.map(transport => {
          return new Promise<void>(resolve => {
            const timeout = setTimeout(() => resolve(), 500); // 500ms timeout
            
            try {
              if (typeof (transport as any).close === 'function') {
                (transport as any).close();
              }
              const stream = (transport as any)._stream;
              if (stream && typeof stream.end === 'function') {
                stream.end(() => {
                  clearTimeout(timeout);
                  resolve();
                });
              } else {
                clearTimeout(timeout);
                resolve();
              }
            } catch (error) {
              clearTimeout(timeout);
              resolve();
            }
          });
        });

        await Promise.all(closePromises);
      };

      // Don't add automatic signal handlers - let main app handle graceful shutdown
      // process.on('beforeExit', shutdownLogger);
      // process.on('SIGINT', async () => {
      //   await shutdownLogger();
      //   process.exit(0);
      // });
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
    if (this.isShuttingDown) return;
    if (error instanceof Error) {
      this.winston.error(this.formatMessage(message), { error: error.message, stack: error.stack });
    } else if (error) {
      this.winston.error(this.formatMessage(message), { error });
    } else {
      this.winston.error(this.formatMessage(message));
    }
  }

  warn(message: string, meta?: any): void {
    if (this.isShuttingDown) return;
    this.winston.warn(this.formatMessage(message), meta);
  }

  info(message: string, meta?: any): void {
    if (this.isShuttingDown) return;
    this.winston.info(this.formatMessage(message), meta);
  }

  http(message: string, meta?: any): void {
    if (this.isShuttingDown) return;
    this.winston.http(this.formatMessage(message), meta);
  }

  verbose(message: string, meta?: any): void {
    if (this.isShuttingDown) return;
    this.winston.verbose(this.formatMessage(message), meta);
  }

  debug(message: string, meta?: any): void {
    if (this.isShuttingDown) return;
    this.winston.debug(this.formatMessage(message), meta);
  }

  silly(message: string, meta?: any): void {
    if (this.isShuttingDown) return;
    this.winston.silly(this.formatMessage(message), meta);
  }

  /**
   * Log shell command execution
   */
  shell(command: string, result?: string, error?: Error): void {
    if (this.isShuttingDown) return;
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
    if (this.isShuttingDown) return;
    this.http(`${method} ${url} ${status ? `(${status})` : ''} ${duration ? `(${duration}ms)` : ''}`);
  }

  /**
   * Log service operations
   */
  service(operation: string, service: string, meta?: any): void {
    if (this.isShuttingDown) return;
    if (meta) {
      // Use Winston's structured logging instead of stringifying in the message
      this.winston.info(this.formatMessage(`${service}: ${operation}`), meta);
    } else {
      this.winston.info(this.formatMessage(`${service}: ${operation}`));
    }
  }

  /**
   * Get underlying Winston instance
   */
  getWinston(): winston.Logger {
    return this.winston;
  }

  /**
   * Force flush all file transports
   */
  flush(): void {
    if (this.isShuttingDown) return;
    this.winston.transports.forEach(transport => {
      if (transport instanceof winston.transports.File) {
        const stream = (transport as any)._stream;
        if (stream && typeof stream.flush === 'function') {
          stream.flush();
        }
      }
    });
  }

  /**
   * Get current buffer stats (if available)
   */
  getBufferStats(): { transportType: string; buffered?: number; highWaterMark?: number }[] {
    return this.winston.transports.map(transport => {
      const stats: { transportType: string; buffered?: number; highWaterMark?: number } = {
        transportType: transport.constructor.name
      };
      
      if (transport instanceof winston.transports.File) {
        const stream = (transport as any)._stream;
        if (stream) {
          stats.buffered = stream._writableState?.bufferedRequestCount || 0;
          stats.highWaterMark = stream._writableState?.highWaterMark || 0;
        }
      }
      
      return stats;
    });
  }
}

/**
 * Default logger instance (singleton)
 */
export const logger = Logger.getInstance();

/**
 * Mark logger as shutting down (prevent new logs)
 */
export function markLoggerShuttingDown(): void {
  if (Logger.hasInstance()) {
    const instance = Logger.getInstance();
    (instance as any).isShuttingDown = true;
  }
}

/**
 * Gracefully shutdown logger (close file streams)
 */
export async function shutdownLogger(): Promise<void> {
  if (Logger.shutdownLogger) {
    await Logger.shutdownLogger();
  }
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

/**
 * Test function to verify stack trace parsing
 * This can be removed in production
 */
export function testLoggerContext(): void {
  logger.info('Testing logger context detection');
  logger.debug('This should show the calling context');
  logger.error('Error test with context');
}
