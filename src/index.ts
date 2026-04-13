import 'dotenv/config';
import { getBot, sendRawMessage, sendStartupGreeting } from './bot/telegramBot.js';
import { activePlatforms as platforms } from './config/platforms.js';
import { startDashboardServer } from './dashboard/server.js';
import {
  loadAccountSnapshot,
  startBackgroundDbRefresh,
  stopBackgroundDbRefresh,
} from './db/supabase.js';
import { getDashboardString, startPolling } from './orchestrator/poller.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('Payment Order Matching System starting...');

  const required = [
    'SUPABASE_URL',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_GROUP_ID',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      logger.error({ key }, `Missing required environment variable: ${key}`);
      process.exit(1);
    }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY) {
    logger.error(
      'Missing Supabase credentials: set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY',
    );
    process.exit(1);
  }

  try {
    getBot();
    logger.info('Telegram bot ready');
  } catch (err) {
    logger.error({ err }, 'Failed to initialise Telegram bot');
    process.exit(1);
  }

  let accountCount = 0;

  try {
    const snapshot = await loadAccountSnapshot();
    accountCount = snapshot.accounts.length;
    logger.info({
      count: accountCount,
      matchBuckets: snapshot.matchIndex.size,
    }, 'Accounts loaded from Supabase');
  } catch (err) {
    logger.error({ err }, 'Failed to load accounts from Supabase - exiting');
    process.exit(1);
  }

  // Start background auto-refresher for ultra fast polling
  startBackgroundDbRefresh();

  const { stop } = startPolling(platforms);
  const dashboardServer = startDashboardServer();

  logger.info(
    `System started. Monitoring ${platforms.length} platforms | `
    + `${accountCount} accounts loaded.`,
  );
  logger.info({ dashboardPort: dashboardServer.port }, 'Admin dashboard available at /panel');

  const bot = getBot();
  bot.onText(/^\/status/, (msg) => {
    if (msg.chat.id.toString() !== process.env.TELEGRAM_GROUP_ID) return;

    logger.info({ user: msg.from?.username }, 'Received /status command');
    const dashboardHtml = getDashboardString();

    bot.sendMessage(msg.chat.id, dashboardHtml, { parse_mode: 'HTML' }).catch((err) => {
      logger.error({ err }, 'Failed to send /status response');
    });
  });

  void sendStartupGreeting(platforms.length);

  setTimeout(() => {
    void sendRawMessage(getDashboardString());
  }, 2000);

  let shutdownStarted = false;

  function gracefulShutdown(signal: string): void {
    if (shutdownStarted) return;
    shutdownStarted = true;

    logger.info({ signal }, 'Shutdown signal received - stopping services...');
    stop();
    stopBackgroundDbRefresh();

    void dashboardServer.stop()
      .then(() => {
        logger.info('Dashboard server stopped');
      })
      .catch((err) => {
        logger.error({ err }, 'Failed to stop dashboard server cleanly');
      })
      .finally(() => {
        setTimeout(() => {
          logger.info('Shutdown complete');
          process.exit(0);
        }, 1000);
      });
  }

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  process.on('uncaughtException', err => {
    logger.error({ err }, 'Uncaught exception');
  });

  process.on('unhandledRejection', reason => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
