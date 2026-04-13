import { sendTelegramAlert } from '../bot/telegramBot.js';
import {
  emitDashboardRefresh,
  recordMatchedOrder,
  recordObservedOrders,
} from '../dashboard/store.js';
import { getSyncAccountSnapshot, loadAccountSnapshot } from '../db/supabase.js';
import { scanPlatformOrders } from '../fetcher/fetchPlatform.js';
import { matchOrder } from '../matcher/matchOrder.js';
import type {
  AccountSnapshot,
  Order,
  PlatformConfig,
  PlatformStatusSnapshot,
} from '../types/index.js';
import { logger } from '../utils/logger.js';

interface PlatformStatus {
  lastPoll: Date | null;
  lastRunSuccess: boolean;
  lastResultsCount: number;
  totalMatchesFound: number;
  inFlight: boolean;
  lastCycleStartedAt: Date | null;
  lastCycleDurationMs: number;
  lastScanPages: number;
  consecutiveFailures: number;
  lastError: string | null;
  lastFreshOrderAt: Date | null;
}

interface KnownOrderEntry {
  seenAt: number;
  crtDate: number;
}

interface PlatformRuntimeState {
  knownOrders: Map<string, KnownOrderEntry>;
  newestCrtDate: number;
  nextAllowedAt: number;
}

const statusMap = new Map<string, PlatformStatus>();
const runtimeStateMap = new Map<string, PlatformRuntimeState>();

const KNOWN_ORDER_TTL_MS = (): number =>
  Number(process.env.SEEN_ORDER_TTL_MS ?? 24 * 60 * 60 * 1000);

const COORDINATOR_INTERVAL_MS = (configs: PlatformConfig[]): number => {
  const configured = Number(process.env.GLOBAL_REFRESH_INTERVAL_MS ?? 0);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }

  const minPlatformInterval = configs.reduce(
    (lowest, platform) => Math.min(lowest, platform.pollIntervalMs),
    Number.MAX_SAFE_INTEGER,
  );

  if (!Number.isFinite(minPlatformInterval) || minPlatformInterval === Number.MAX_SAFE_INTEGER) {
    return 1000;
  }

  return Math.max(250, Math.floor(minPlatformInterval));
};

const FAILURE_BACKOFF_BASE_MS = (platform: PlatformConfig): number => {
  const configured = Number(
    platform.failureBackoffMs ?? process.env.PLATFORM_FAILURE_BACKOFF_MS ?? 2000,
  );

  if (!Number.isFinite(configured) || configured < 500) {
    return 2000;
  }

  return Math.floor(configured);
};

const FAILURE_BACKOFF_MAX_MS = (): number => {
  const configured = Number(process.env.PLATFORM_FAILURE_BACKOFF_MAX_MS ?? 30000);
  if (!Number.isFinite(configured) || configured < 1000) {
    return 30000;
  }

  return Math.floor(configured);
};

function buildOrderKey(order: Order): string {
  return order.orderNo || order.rptNo || '';
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

function createDefaultStatus(): PlatformStatus {
  return {
    lastPoll: null,
    lastRunSuccess: true,
    lastResultsCount: 0,
    totalMatchesFound: 0,
    inFlight: false,
    lastCycleStartedAt: null,
    lastCycleDurationMs: 0,
    lastScanPages: 0,
    consecutiveFailures: 0,
    lastError: null,
    lastFreshOrderAt: null,
  };
}

function updatePlatformStatus(
  platformId: string,
  partial: Partial<PlatformStatus>,
): PlatformStatus {
  const current = statusMap.get(platformId) ?? createDefaultStatus();
  const next = { ...current, ...partial };
  statusMap.set(platformId, next);
  emitDashboardRefresh();
  return next;
}

function ensureRuntimeState(platformId: string): PlatformRuntimeState {
  const existing = runtimeStateMap.get(platformId);
  if (existing) {
    return existing;
  }

  const created: PlatformRuntimeState = {
    knownOrders: new Map<string, KnownOrderEntry>(),
    newestCrtDate: 0,
    nextAllowedAt: 0,
  };
  runtimeStateMap.set(platformId, created);
  return created;
}

function rememberKnownOrder(
  runtimeState: PlatformRuntimeState,
  order: Order,
  seenAt: number,
): void {
  const key = buildOrderKey(order);
  if (!key) {
    return;
  }

  runtimeState.knownOrders.set(key, {
    seenAt,
    crtDate: order.crtDate,
  });

  if (order.crtDate > runtimeState.newestCrtDate) {
    runtimeState.newestCrtDate = order.crtDate;
  }
}

function pruneKnownOrders(platformId: string, runtimeState: PlatformRuntimeState): void {
  const now = Date.now();
  const ttlMs = KNOWN_ORDER_TTL_MS();
  let removed = 0;

  for (const [key, entry] of runtimeState.knownOrders.entries()) {
    if (now - entry.seenAt > ttlMs) {
      runtimeState.knownOrders.delete(key);
      removed += 1;
    }
  }

  if (removed > 0) {
    logger.debug({ platform: platformId, removed }, 'Known order cache pruned');
  }
}

function getFailureBackoffMs(platform: PlatformConfig, failures: number): number {
  const multiplier = Math.max(0, failures - 1);
  const backoff = FAILURE_BACKOFF_BASE_MS(platform) * (2 ** multiplier);
  return Math.min(backoff, FAILURE_BACKOFF_MAX_MS());
}

async function getAccountSnapshotForCycle(): Promise<AccountSnapshot> {
  const cachedSnapshot = getSyncAccountSnapshot();
  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  return loadAccountSnapshot();
}

function logStatusDashboard(): void {
  const tableData = Array.from(statusMap.entries()).map(([platformId, status]) => ({
    Platform: platformId,
    State: status.inFlight ? 'RUNNING' : (status.lastRunSuccess ? 'OK' : 'FAIL'),
    New_Orders: status.lastResultsCount,
    Matches: status.totalMatchesFound,
    Pages: status.lastScanPages,
    Cycle_ms: status.lastCycleDurationMs,
    Failures: status.consecutiveFailures,
    Last_Poll: status.lastPoll?.toLocaleTimeString() ?? 'Never',
  }));

  console.log('\n=== [ PLATFORM SYSTEM DASHBOARD ] ===');
  console.table(tableData);
  console.log('=====================================\n');
}

async function processOrderMatch(
  platformId: string,
  order: Order,
  accountSnapshot: AccountSnapshot,
): Promise<boolean> {
  const platformLog = logger.child({ platform: platformId, orderNo: order.orderNo });

  try {
    const match = matchOrder(order, accountSnapshot.matchIndex);
    if (!match) {
      return false;
    }

    platformLog.info(
      {
        dbAccountId: match.id,
        amount: order.amount,
        subagentId: match.subagentId ?? null,
      },
      'Match found - sending alert',
    );

    recordMatchedOrder(order, match);
    await sendTelegramAlert(order, match);
    return true;
  } catch (error) {
    platformLog.error(
      { error, orderNo: order.orderNo },
      'Error during match/alert - skipping order',
    );
    return false;
  }
}

async function refreshPlatform(
  platform: PlatformConfig,
  accountSnapshot: AccountSnapshot,
  cycleStartedAt: number,
): Promise<void> {
  const runtimeState = ensureRuntimeState(platform.id);
  const platformLog = logger.child({ platform: platform.id });
  const now = Date.now();

  pruneKnownOrders(platform.id, runtimeState);

  if (now < runtimeState.nextAllowedAt) {
    platformLog.debug(
      { waitMs: runtimeState.nextAllowedAt - now },
      'Skipping cycle because platform is in failure backoff',
    );
    return;
  }

  updatePlatformStatus(platform.id, {
    inFlight: true,
    lastCycleStartedAt: new Date(cycleStartedAt),
  });

  let matchedThisCycle = 0;
  let observedThisCycle = 0;
  let scannedPages = 0;

  try {
    const knownOrderKeys = new Set(runtimeState.knownOrders.keys());
    const scanResult = await scanPlatformOrders(
      platform,
      async (orders) => {
        if (orders.length === 0) {
          return;
        }

        const seenAt = Date.now();
        observedThisCycle += orders.length;

        for (const order of orders) {
          rememberKnownOrder(runtimeState, order, seenAt);
        }

        recordObservedOrders(orders);

        const results = await Promise.all(
          orders.map(order => processOrderMatch(platform.id, order, accountSnapshot)),
        );

        matchedThisCycle += results.filter(Boolean).length;
      },
      (_platformId, page, count) => {
        scannedPages = Math.max(scannedPages, page);
        platformLog.info({ page, newOrders: count }, 'Page scanned');
      },
      {
        knownOrderKeys,
        lastSeenCrtDate: runtimeState.newestCrtDate,
      },
    );

    if (
      scanResult.newestOrderCrtDate !== null
      && scanResult.newestOrderCrtDate > runtimeState.newestCrtDate
    ) {
      runtimeState.newestCrtDate = scanResult.newestOrderCrtDate;
    }

    runtimeState.nextAllowedAt = 0;

    const completedAt = new Date();
    const currentStatus = statusMap.get(platform.id) ?? createDefaultStatus();

    updatePlatformStatus(platform.id, {
      lastPoll: completedAt,
      lastRunSuccess: true,
      lastResultsCount: observedThisCycle,
      totalMatchesFound: currentStatus.totalMatchesFound + matchedThisCycle,
      inFlight: false,
      lastCycleDurationMs: completedAt.getTime() - cycleStartedAt,
      lastScanPages: scanResult.scannedPages,
      consecutiveFailures: 0,
      lastError: null,
      lastFreshOrderAt: observedThisCycle > 0
        ? completedAt
        : currentStatus.lastFreshOrderAt,
    });

    if (observedThisCycle > 0) {
      platformLog.info(
        {
          newOrders: observedThisCycle,
          matches: matchedThisCycle,
          scannedPages: scanResult.scannedPages,
        },
        'Platform refresh completed with new orders',
      );
    }
  } catch (error) {
    const currentStatus = statusMap.get(platform.id) ?? createDefaultStatus();
    const failures = currentStatus.consecutiveFailures + 1;
    runtimeState.nextAllowedAt = Date.now() + getFailureBackoffMs(platform, failures);

    updatePlatformStatus(platform.id, {
      lastPoll: new Date(),
      lastRunSuccess: false,
      lastResultsCount: observedThisCycle,
      inFlight: false,
      lastCycleDurationMs: Date.now() - cycleStartedAt,
      lastScanPages: scannedPages,
      consecutiveFailures: failures,
      lastError: toErrorMessage(error),
    });

    platformLog.error({ error }, 'Platform refresh failed');
  }
}

export function getDashboardString(): string {
  if (statusMap.size === 0) {
    return '<i>System is currently starting up...</i>';
  }

  const lines = ['<b>PLATFORM SYSTEM DASHBOARD</b>', ''];
  let totalMatches = 0;

  for (const [platformId, status] of statusMap.entries()) {
    const stateLabel = status.inFlight ? 'RUNNING' : (status.lastRunSuccess ? 'OK' : 'FAIL');
    totalMatches += status.totalMatchesFound;

    lines.push(`[${stateLabel}] <b>${platformId.toUpperCase()}</b>`);
    lines.push(`New Orders: ${status.lastResultsCount}`);
    lines.push(`Matches: ${status.totalMatchesFound}`);
    lines.push(`Pages: ${status.lastScanPages}`);
    lines.push(`Cycle: ${status.lastCycleDurationMs} ms`);
    lines.push(`Last Poll: ${status.lastPoll?.toLocaleTimeString() ?? 'Never'}`);
    lines.push('');
  }

  lines.push(`<b>Total System Matches: ${totalMatches}</b>`);
  return lines.join('\n');
}

export function getPlatformStatusSnapshot(): PlatformStatusSnapshot[] {
  return Array.from(statusMap.entries()).map(([platformId, status]) => ({
    platformId,
    lastPoll: status.lastPoll ? status.lastPoll.toISOString() : null,
    lastRunSuccess: status.lastRunSuccess,
    lastResultsCount: status.lastResultsCount,
    totalMatchesFound: status.totalMatchesFound,
    inFlight: status.inFlight,
    lastCycleStartedAt: status.lastCycleStartedAt
      ? status.lastCycleStartedAt.toISOString()
      : null,
    lastCycleDurationMs: status.lastCycleDurationMs,
    lastScanPages: status.lastScanPages,
    consecutiveFailures: status.consecutiveFailures,
    lastError: status.lastError,
    lastFreshOrderAt: status.lastFreshOrderAt
      ? status.lastFreshOrderAt.toISOString()
      : null,
  }));
}

export function startPolling(configs: PlatformConfig[]): { stop: () => void } {
  const stopSignal = { stopped: false };
  const coordinatorIntervalMs = COORDINATOR_INTERVAL_MS(configs);
  let cycleTimer: NodeJS.Timeout | null = null;
  let cycleInFlight = false;

  for (const platform of configs) {
    ensureRuntimeState(platform.id);
    updatePlatformStatus(platform.id, createDefaultStatus());
  }

  const runCycle = async (): Promise<void> => {
    if (stopSignal.stopped || cycleInFlight) {
      return;
    }

    cycleInFlight = true;
    const cycleStartedAt = Date.now();

    try {
      const accountSnapshot = await getAccountSnapshotForCycle();
      await Promise.all(
        configs.map(platform => refreshPlatform(platform, accountSnapshot, cycleStartedAt)),
      );
    } catch (error) {
      logger.error({ error }, 'Coordinator cycle failed before platform refresh');
    } finally {
      cycleInFlight = false;

      if (!stopSignal.stopped) {
        const elapsedMs = Date.now() - cycleStartedAt;
        const delayMs = Math.max(0, coordinatorIntervalMs - elapsedMs);
        cycleTimer = setTimeout(() => {
          void runCycle();
        }, delayMs);
      }
    }
  };

  const dashboardInterval = setInterval(logStatusDashboard, 30000);
  void runCycle();

  logger.info(
    { count: configs.length, coordinatorIntervalMs },
    'Realtime polling coordinator started',
  );

  return {
    stop: () => {
      stopSignal.stopped = true;
      if (cycleTimer) {
        clearTimeout(cycleTimer);
      }
      clearInterval(dashboardInterval);
      logger.info('Stop signal sent to polling coordinator');
    },
  };
}
