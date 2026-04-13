import { sendTelegramAlert } from '../bot/telegramBot.js';
import {
  emitDashboardRefresh,
  recordMatchedOrder,
  recordObservedOrders,
} from '../dashboard/store.js';
import { getSyncAccountSnapshot } from '../db/supabase.js';
import { scanPlatformOrders } from '../fetcher/fetchPlatform.js';
import { matchOrder } from '../matcher/matchOrder.js';
import type { PlatformConfig, PlatformStatusSnapshot } from '../types/index.js';
import { logger } from '../utils/logger.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const SEEN_RESET_MS = () => Number(process.env.SEEN_RESET_INTERVAL_MS ?? 300_000);

interface PlatformStatus {
  lastPoll: Date | null;
  lastRunSuccess: boolean;
  lastResultsCount: number;
  totalMatchesFound: number;
}

const statusMap = new Map<string, PlatformStatus>();

function updatePlatformStatus(
  platformId: string,
  partial: Partial<PlatformStatus>,
): PlatformStatus {
  const current = statusMap.get(platformId) ?? {
    lastPoll: null,
    lastRunSuccess: true,
    lastResultsCount: 0,
    totalMatchesFound: 0,
  };

  const next = { ...current, ...partial };
  statusMap.set(platformId, next);
  emitDashboardRefresh();
  return next;
}

function logStatusDashboard() {
  const tableData = Array.from(statusMap.entries()).map(([id, status]) => ({
    Platform: id,
    Status: status.lastRunSuccess ? 'OK' : 'FAIL',
    Fetched: status.lastResultsCount,
    Matches: status.totalMatchesFound,
    Last_Poll: status.lastPoll?.toLocaleTimeString() ?? 'Never',
  }));

  console.log('\n=== [ PLATFORM SYSTEM DASHBOARD ] ===');
  console.table(tableData);
  console.log('=====================================\n');
}

export function getDashboardString(): string {
  if (statusMap.size === 0) return '<i>System is currently starting up...</i>';

  const lines = ['📊 <b>PLATFORM SYSTEM DASHBOARD</b>', ''];
  let totalMatches = 0;

  for (const [id, status] of statusMap.entries()) {
    const symbol = status.lastRunSuccess ? '✅' : '❌';
    totalMatches += status.totalMatchesFound;

    lines.push(`${symbol} <b>${id.toUpperCase()}</b>`);
    lines.push(`├ Fetched: ${status.lastResultsCount}`);
    lines.push(`├ Matches: ${status.totalMatchesFound}`);
    lines.push(`└ Last: ${status.lastPoll?.toLocaleTimeString() ?? 'Never'}`);
    lines.push('');
  }

  lines.push(`🏆 <b>Total System Matches: ${totalMatches}</b>`);
  return lines.join('\n');
}

export function getPlatformStatusSnapshot(): PlatformStatusSnapshot[] {
  return Array.from(statusMap.entries()).map(([platformId, status]) => ({
    platformId,
    lastPoll: status.lastPoll ? status.lastPoll.toISOString() : null,
    lastRunSuccess: status.lastRunSuccess,
    lastResultsCount: status.lastResultsCount,
    totalMatchesFound: status.totalMatchesFound,
  }));
}

async function runPlatformLoop(
  platform: PlatformConfig,
  stopSignal: { stopped: boolean },
): Promise<void> {
  const platformLog = logger.child({ platform: platform.id });
  const seenOrders = new Map<string, number>();
  let lastReset = Date.now();

  platformLog.info('Polling loop started');

  while (!stopSignal.stopped) {
    try {
      if (Date.now() - lastReset >= SEEN_RESET_MS()) {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        let deleted = 0;
        for (const [key, ts] of seenOrders.entries()) {
          if (now - ts > maxAge) {
            seenOrders.delete(key);
            deleted++;
          }
        }
        lastReset = now;
        platformLog.debug(`seenOrders cache pruned (${deleted} old orders removed)`);
      }

      const accountSnapshot = getSyncAccountSnapshot();
      if (!accountSnapshot) {
        await sleep(1000);
        continue;
      }
      let fetchedCount = 0;

      try {
        fetchedCount = await scanPlatformOrders(
          platform,
          async (orders) => {
            recordObservedOrders(orders);

            for (const order of orders) {
              const key = order.orderNo || order.rptNo || '';
              if (!key || seenOrders.has(key)) continue;

              seenOrders.set(key, Date.now());

              try {
                const match = matchOrder(order, accountSnapshot.matchIndex);
                if (!match) continue;

                const currentStatus = statusMap.get(platform.id);
                updatePlatformStatus(platform.id, {
                  totalMatchesFound: (currentStatus?.totalMatchesFound ?? 0) + 1,
                });

                platformLog.info(
                  {
                    orderNo: order.orderNo,
                    dbAccountId: match.id,
                    amount: order.amount,
                    subagentId: match.subagentId ?? null,
                  },
                  'Match found - sending alert',
                );

                recordMatchedOrder(order, match);
                await sendTelegramAlert(order, match);
              } catch (matchErr) {
                platformLog.error(
                  { matchErr, orderNo: order.orderNo },
                  'Error during match/alert - skipping order',
                );
              }
            }
          },
          (_platformId, page, count) => {
            fetchedCount += count;
            updatePlatformStatus(platform.id, {
              lastPoll: new Date(),
              lastRunSuccess: true,
              lastResultsCount: fetchedCount,
            });
            platformLog.info(`[Page ${page}] Found ${count} candidate orders`);
          },
        );

        updatePlatformStatus(platform.id, {
          lastPoll: new Date(),
          lastRunSuccess: true,
          lastResultsCount: fetchedCount,
        });
      } catch (fetchErr) {
        updatePlatformStatus(platform.id, {
          lastPoll: new Date(),
          lastRunSuccess: false,
          lastResultsCount: fetchedCount,
        });
        throw fetchErr;
      }

      if (fetchedCount > 0) {
        platformLog.info({ count: fetchedCount }, 'All fetched orders processed');
      }
    } catch (loopErr) {
      platformLog.error({ loopErr }, 'Unhandled error in polling loop iteration');
      updatePlatformStatus(platform.id, {
        lastPoll: new Date(),
        lastRunSuccess: false,
      });
    }

    await sleep(platform.pollIntervalMs);
  }

  platformLog.info('Polling loop stopped');
}

export function startPolling(
  configs: PlatformConfig[],
): { stop: () => void } {
  const stopSignal = { stopped: false };

  for (const platform of configs) {
    updatePlatformStatus(platform.id, {
      lastPoll: null,
      lastRunSuccess: true,
      lastResultsCount: 0,
      totalMatchesFound: 0,
    });

    void runPlatformLoop(platform, stopSignal).catch(fatalErr => {
      logger.error(
        { fatalErr, platform: platform.id },
        'Platform loop terminated unexpectedly',
      );
    });
  }

  const dashboardInterval = setInterval(logStatusDashboard, 30_000);

  logger.info({ count: configs.length }, 'All platform polling loops started');

  return {
    stop: () => {
      stopSignal.stopped = true;
      clearInterval(dashboardInterval);
      logger.info('Stop signal sent to all polling loops');
    },
  };
}
