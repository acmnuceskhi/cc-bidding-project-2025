/**
 * Environment-aware logging utility
 * Reduces production console overhead by gating debug/info logs
 */

const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

export const logger = {
  /**
   * Debug logs - only in development
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Info logs - only in development and test
   */
  info: (...args: any[]) => {
    if (isDev || isTest) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * Warning logs - always shown
   */
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },

  /**
   * Error logs - always shown
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },

  /**
   * Performance logs - only in development
   */
  perf: (label: string, startTime: number) => {
    if (isDev) {
      const duration = Date.now() - startTime;
      console.log(`[PERF] ${label}: ${duration}ms`);
    }
  },
};
