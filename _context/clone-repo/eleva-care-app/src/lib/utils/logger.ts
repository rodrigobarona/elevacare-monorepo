/**
 * Structured logging utility for production-grade logging
 *
 * Provides consistent, structured logging with proper levels and context.
 * Easy to integrate with monitoring services like Sentry, BetterStack, DataDog, etc.
 *
 * @example
 * ```typescript
 * import { logger } from '@/lib/utils/logger';
 *
 * logger.info('User logged in', { userId: '123', method: 'oauth' });
 * logger.error('Payment failed', { orderId: 'ord_123', error: err.message });
 * ```
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  environment?: string;
}

class Logger {
  private environment: string;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Format and output log entry
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      environment: this.environment,
    };

    // In development, use pretty printing
    if (this.environment === 'development') {
      const emoji = this.getLevelEmoji(level);
      const contextStr = context ? ` ${JSON.stringify(context, null, 2)}` : '';
      console[level === 'debug' ? 'log' : level](
        `${emoji} [${level.toUpperCase()}] ${message}${contextStr}`,
      );
      return;
    }

    // In production, use structured JSON for easy parsing
    console[level === 'debug' ? 'log' : level](JSON.stringify(entry));
  }

  /**
   * Get emoji for log level (development mode only)
   */
  private getLevelEmoji(level: LogLevel): string {
    const emojis = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    };
    return emojis[level];
  }

  /**
   * Log debug messages (verbose information for development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.environment === 'development') {
      this.log('debug', message, context);
    }
  }

  /**
   * Log informational messages
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error messages
   */
  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  /**
   * Create a child logger with preset context
   * Useful for adding consistent context across multiple log calls
   *
   * @example
   * ```typescript
   * const userLogger = logger.child({ userId: '123' });
   * userLogger.info('Action performed'); // Automatically includes userId
   * ```
   */
  child(baseContext: LogContext): Logger {
    const childLogger = new Logger();
    const originalLog = childLogger.log.bind(childLogger);

    childLogger.log = (level: LogLevel, message: string, context?: LogContext) => {
      originalLog(level, message, { ...baseContext, ...context });
    };

    return childLogger;
  }
}

// Export singleton instance
export const logger = new Logger();
