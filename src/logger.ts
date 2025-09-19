// src/logger.ts

/**
 * Logger utility for conditional debug logging.
 * Only logs if process.env.DEBUG_LOG is set to 'true'.
 */

export function logger(message: string) {
  if (process.env.DEBUG_LOG === 'true') {
    // eslint-disable-next-line no-console
    console.log(`[DEBUG] ${message}`);
  }
}
