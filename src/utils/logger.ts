// ============================================================
// Shared Logger (pino)
// ============================================================

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? {
        target:  'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      }
    : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  base:      { pid: process.pid },
});
