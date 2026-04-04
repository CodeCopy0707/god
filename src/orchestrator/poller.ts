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

// ── Global status store ──────────────────────────────────────────────────
interface PlatformStatus {
  lastPoll:       Date | null;
  lastRunSuccess: boolean;
  lastResultsCount: number;
  totalMatchesFound: number;
}
const statusMap = new Map<string, PlatformStatus>();

function logStatusDashboard() {
  const tableData = Array.from(statusMap.entries()).map(([id, status]) => ({
    Platform: id,
    Status:   status.lastRunSuccess ? '✅ OK' : '❌ FAIL',
    Fetched:  status.lastResultsCount,
    Matches:  status.totalMatchesFound,
    Last_Poll: status.lastPoll?.toLocaleTimeString() ?? 'Never',
  }));

  console.log('\n📊 === [ PLATFORM SYSTEM DASHBOARD ] ===');
  console.table(tableData);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

export function getDashboardString(): string {
  if (statusMap.size === 0) return '<i>System is currently starting up...</i>';

  const lines = ['📊 <b>PLATFORM SYSTEM DASHBOARD</b>', ''];
  
  let totalMatches = 0;
  
  for (const [id, status] of statusMap.entries()) {
    const symbol = status.lastRunSuccess ? '✅' : '❌';
    const fetched = status.lastResultsCount;
    const matches = status.totalMatchesFound;
    const time = status.lastPoll?.toLocaleTimeString() ?? 'Never';
    
    totalMatches += matches;

    lines.push(`${symbol} <b>${id.toUpperCase()}</b>`);
    lines.push(`├ Fetched: ${fetched}`);
    lines.push(`├ Matches: ${matches}`);
    lines.push(`└ Last: ${time}`);
    lines.push(''); // blank line between platforms
  }
  
  lines.push(`🏆 <b>Total System Matches: ${totalMatches}</b>`);
  
  return lines.join('\n');
}

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
      let orders = [];
      try {
        orders = await fetchAllPages(platform, (pid, page, count) => {
          platformLog.info(`[Page ${page}] 🔍 Found ${count} orders > 5k`);
        });
        
        statusMap.set(platform.id, {
          ...statusMap.get(platform.id)!,
          lastPoll:       new Date(),
          lastRunSuccess: true,
          lastResultsCount: orders.length,
        });

      } catch (fetchErr) {
        statusMap.set(platform.id, {
          ...statusMap.get(platform.id)!,
          lastPoll:       new Date(),
          lastRunSuccess: false,
          lastResultsCount: 0,
        });
        throw fetchErr; // Re-throw to be caught by the loop catch block
      }
      
      if (orders.length > 0) {
        platformLog.info({ count: orders.length }, '✅ All pages fetched');
      }

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
            statusMap.set(platform.id, {
              ...statusMap.get(platform.id)!,
              totalMatchesFound: statusMap.get(platform.id)!.totalMatchesFound + 1,
            });
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
      statusMap.set(platform.id, {
        ...statusMap.get(platform.id)!,
        lastPoll:       new Date(),
        lastRunSuccess: false,
      });
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
    statusMap.set(platform.id, {
      lastPoll:       null,
      lastRunSuccess: true,
      lastResultsCount: 0,
      totalMatchesFound: 0,
    });

    // Each loop runs independently — one failure doesn't affect others
    void runPlatformLoop(platform, stopSignal).catch(fatalErr => {
      logger.error({ fatalErr, platform: platform.id },
        'Platform loop terminated unexpectedly');
    });
  }

  // ── Start periodic dashboard reporter ───────────────────────────────
  const dashboardInterval = setInterval(logStatusDashboard, 30_000); // Every 30s

  logger.info({ count: configs.length }, 'All platform polling loops started');

  return {
    stop: () => {
      stopSignal.stopped = true;
      clearInterval(dashboardInterval);
      logger.info('Stop signal sent to all polling loops');
    },
  };
}
