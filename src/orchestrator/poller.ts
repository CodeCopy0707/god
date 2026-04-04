// ============================================================
// Polling Orchestrator — Independent per-platform async loops
// ============================================================

import { fetchAllPages }      from '../fetcher/fetchPlatform.js';
import { matchOrder }         from '../matcher/matchOrder.js';
import { loadAccounts }       from '../db/supabase.js';
import { sendTelegramAlert }  from '../bot/telegramBot.js';
import { logger }             from '../utils/logger.js';
import type { PlatformConfig } from '../types/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const SEEN_RESET_MS = () =>
  Number(process.env.SEEN_RESET_INTERVAL_MS ?? 300_000); // 5 minutes

// ── Single platform polling loop ──────────────────────────────────────────
async function runPlatformLoop(
  platform: PlatformConfig,
  stopSignal: { stopped: boolean },
): Promise<void> {
  const platformLog = logger.child({ platform: platform.id });
  const seenOrders  = new Set<string>();
  let   lastReset   = Date.now();

  platformLog.info('Polling loop started');

  while (!stopSignal.stopped) {
    try {
      // ── Periodic seenOrders reset ──────────────────────────────────────
      if (Date.now() - lastReset >= SEEN_RESET_MS()) {
        seenOrders.clear();
        lastReset = Date.now();
        platformLog.debug('seenOrders cache cleared');
      }

      // ── Fetch orders ───────────────────────────────────────────────────
      const orders = await fetchAllPages(platform);
      platformLog.debug({ count: orders.length }, 'Orders fetched');

      // ── Load current DB accounts (served from 60 s cache) ──────────────
      const dbAccounts = await loadAccounts();

      // ── Process each new order ─────────────────────────────────────────
      for (const order of orders) {
        const key = order.orderNo || order.rptNo || '';
        if (!key || seenOrders.has(key)) continue;

        seenOrders.add(key);

        try {
          const match = matchOrder(order, dbAccounts);
          if (match) {
            platformLog.info(
              { orderNo: order.orderNo, dbAccountId: match.id, amount: order.amount },
              '✅ Match found — sending alert',
            );
            await sendTelegramAlert(order);
          }
        } catch (matchErr) {
          platformLog.error({ matchErr, orderNo: order.orderNo },
            'Error during match/alert — skipping order');
        }
      }
    } catch (loopErr) {
      platformLog.error({ loopErr }, 'Unhandled error in polling loop iteration');
    }

    // ── Wait before next poll ──────────────────────────────────────────
    await sleep(platform.pollIntervalMs);
  }

  platformLog.info('Polling loop stopped');
}

// ── Start all platform loops ──────────────────────────────────────────────
export function startPolling(
  configs: PlatformConfig[],
): { stop: () => void } {
  const stopSignal = { stopped: false };

  for (const platform of configs) {
    // Each loop runs independently — one failure doesn't affect others
    void runPlatformLoop(platform, stopSignal).catch(fatalErr => {
      logger.error({ fatalErr, platform: platform.id },
        'Platform loop terminated unexpectedly');
    });
  }

  logger.info({ count: configs.length }, 'All platform polling loops started');

  return {
    stop: () => {
      stopSignal.stopped = true;
      logger.info('Stop signal sent to all polling loops');
    },
  };
}
