// ============================================================
// Entry Point — Payment Order Matching & Alerting System
// ============================================================

import 'dotenv/config';
import { activePlatforms as platforms } from './config/platforms.js';
import { getBot, sendStartupGreeting, sendRawMessage } from './bot/telegramBot.js';
import { loadAccounts }  from './db/supabase.js';
import { startPolling, getDashboardString }  from './orchestrator/poller.js';
import { logger }        from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('🚀 Payment Order Matching System starting...');

  // ── 1. Validate required environment variables ─────────────────────────
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_GROUP_ID',
  ];
  for (const key of required) {
    if (!process.env[key]) {
      logger.error({ key }, `Missing required environment variable: ${key}`);
      process.exit(1);
    }
  }

  // ── 2. Initialise Telegram bot ─────────────────────────────────────────
  try {
    getBot();
    logger.info('✅ Telegram bot ready');
  } catch (err) {
    logger.error({ err }, 'Failed to initialise Telegram bot');
    process.exit(1);
  }

  // ── 3. Load accounts from Supabase (fail fast if unreachable) ──────────
  let accountCount: number;
  try {
    const accounts = await loadAccounts();
    accountCount = accounts.length;
    logger.info({ count: accountCount }, '✅ Accounts loaded from Supabase');
  } catch (err) {
    logger.error({ err }, 'Failed to load accounts from Supabase — exiting');
    process.exit(1);
  }

  // ── 4. Start per-platform polling loops ────────────────────────────────
  const { stop } = startPolling(platforms);

  logger.info(
    `✅ System started. Monitoring ${platforms.length} platforms | `
    + `${accountCount} accounts loaded.`,
  );

  // ── 5. Wire up Telegram commands & trigger greeting ───────────────────
  const bot = getBot();
  bot.onText(/^\/status/, (msg) => {
    if (msg.chat.id.toString() !== process.env.TELEGRAM_GROUP_ID) return;
    
    logger.info({ user: msg.from?.username }, 'Received /status command');
    const dashboardHtml = getDashboardString();
    
    // Send it back immediately using the standard send API, bypassing the queue
    // to ensure instantaneous feedback for commands
    bot.sendMessage(msg.chat.id, dashboardHtml, { parse_mode: 'HTML' }).catch((err) => {
      logger.error({ err }, 'Failed to send /status response');
    });
  });

  // Send the startup greeting
  void sendStartupGreeting(platforms.length);

  // Send the immediate initial status to group to satisfy requirement that it shows on start
  setTimeout(() => {
    void sendRawMessage(getDashboardString());
  }, 2000); // Give it a couple seconds to do the first fetch

  // ── 6. Graceful shutdown ───────────────────────────────────────────────
  function gracefulShutdown(signal: string): void {
    logger.info({ signal }, 'Shutdown signal received — stopping pollers...');
    stop();
    setTimeout(() => {
      logger.info('Shutdown complete');
      process.exit(0);
    }, 2_000);
  }

  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  process.on('uncaughtException', err => {
    logger.error({ err }, 'Uncaught exception');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
