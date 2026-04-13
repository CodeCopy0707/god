import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import type {
  Order,
  PlatformConfig,
  RawOrder,
  RawOrderResponse,
} from '../types/index.js';

interface PageResult {
  rawRows: RawOrder[];
  error?: string;
}

interface OrderBatchMeta {
  page: number;
  rawCount: number;
  totalOrders: number;
}

interface NormalisedPageResult {
  orders: Order[];
  newestCrtDate: number | null;
  oldestCrtDate: number | null;
  duplicateCount: number;
  knownCount: number;
}

export interface ScanPlatformOrdersOptions {
  knownOrderKeys?: Set<string>;
  lastSeenCrtDate?: number;
  lookbackSeconds?: number;
  stopAfterStalePages?: number;
}

export interface ScanPlatformOrdersResult {
  totalOrders: number;
  scannedPages: number;
  newestOrderCrtDate: number | null;
}

type OrdersBatchHandler = (
  orders: Order[],
  meta: OrderBatchMeta,
) => Promise<void> | void;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRequestTimeoutMs(platform: PlatformConfig): number {
  const configured = Number(
    platform.requestTimeoutMs ?? process.env.FETCH_REQUEST_TIMEOUT_MS ?? 15_000,
  );

  if (!Number.isFinite(configured) || configured < 1_000) {
    return 15_000;
  }

  return Math.floor(configured);
}

function getLookbackSeconds(
  platform: PlatformConfig,
  options?: ScanPlatformOrdersOptions,
): number {
  const configured = Number(
    options?.lookbackSeconds
      ?? platform.freshnessLookbackSeconds
      ?? process.env.FETCH_FRESHNESS_LOOKBACK_SECONDS
      ?? 180,
  );

  if (!Number.isFinite(configured) || configured < 0) {
    return 180;
  }

  return Math.floor(configured);
}

function getStalePageThreshold(
  platform: PlatformConfig,
  options?: ScanPlatformOrdersOptions,
): number {
  const configured = Number(
    options?.stopAfterStalePages
      ?? platform.stalePageThreshold
      ?? process.env.FETCH_STOP_AFTER_STALE_PAGES
      ?? 2,
  );

  if (!Number.isFinite(configured) || configured < 1) {
    return 2;
  }

  return Math.floor(configured);
}

function normaliseOrder(raw: RawOrder, platformId: string): Order | null {
  try {
    const orderNo = String(raw.orderNo ?? raw.order_no ?? '').trim();
    const acctCode = String(raw.acctCode ?? raw.acct_code ?? raw.ifsc ?? '').trim();
    const acctName = String(
      raw.acctName ?? raw.acct_name ?? raw.account_name ?? raw.name ?? '',
    ).trim();
    const acctNo = String(
      raw.acctNo ?? raw.acct_no ?? raw.upi_account ?? raw.upi ?? '',
    ).trim();
    const amount = Number(raw.amount ?? 0);

    let crtDate = Number(raw.crtDate ?? raw.crt_date ?? 0);
    if (!crtDate && raw.created_at) {
      const parsed = Date.parse(String(raw.created_at));
      if (!Number.isNaN(parsed)) {
        crtDate = Math.floor(parsed / 1_000);
      }
    }

    if (!orderNo || !acctNo || !acctCode) {
      logger.warn(
        { platformId, orderNo, acctNo, acctCode, raw },
        'Missing required fields in raw order',
      );
      return null;
    }

    return {
      platform: platformId,
      orderNo,
      rptNo: raw.rptNo
        ? String(raw.rptNo)
        : raw.rpt_no
          ? String(raw.rpt_no)
          : undefined,
      acctNo,
      acctCode,
      acctName,
      amount,
      realAmount: raw.realAmount !== undefined
        ? Number(raw.realAmount)
        : raw.real_amount !== undefined
          ? Number(raw.real_amount)
          : undefined,
      reward: raw.reward !== undefined ? Number(raw.reward) : undefined,
      orderState: Number(raw.orderState ?? raw.order_state ?? raw.status ?? 0),
      crtDate,
      userId: raw.userId
        ? String(raw.userId)
        : raw.user_id
          ? String(raw.user_id)
          : undefined,
    };
  } catch (err) {
    logger.warn({ err, raw }, 'Failed to normalise order');
    return null;
  }
}

function extractOrders(body: RawOrderResponse): RawOrder[] {
  if (body.code !== undefined && Number(body.code) !== 0 && Number(body.code) !== 200) {
    logger.warn({ code: body.code }, 'API returned a non-zero/non-200 code');
    return [];
  }

  if (Array.isArray(body.data?.products)) return body.data.products;
  if (Array.isArray(body.data?.list)) return body.data.list;
  if (Array.isArray(body.data?.records)) return body.data.records;
  if (Array.isArray(body.data?.rows)) return body.data.rows;
  if (Array.isArray(body.list)) return body.list;
  if (Array.isArray(body.records)) return body.records;

  return [];
}

function buildUrl(platform: PlatformConfig, page: number): string {
  const isModern = platform.apiStyle === 'modern';
  const params: Record<string, string> = {
    [isModern ? 'page_num' : 'page']: String(page),
    [isModern ? 'page_size' : 'limit']: String(platform.pageSize),
    if_asc: 'false',
    min_amount: String(
      Number(process.env.FETCH_MIN_AMOUNT ?? process.env.MIN_AMOUNT ?? 9000),
    ),
    max_amount: '100000000',
    method: '1',
    date_asc: '1',
  };

  if (isModern) {
    params.type = 'max';
    params.sort_by = 'desc';
  }

  if (platform.customParams) {
    Object.assign(params, platform.customParams);
  }

  const searchParams = new URLSearchParams(params);
  return `${platform.baseUrl}?${searchParams.toString()}`;
}

async function fetchSinglePage(
  platform: PlatformConfig,
  page: number,
  attempt = 1,
): Promise<PageResult> {
  const url = buildUrl(platform, page);

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...platform.headers,
      ...platform.customHeaders,
    };

    if (platform.useBearerAuth) {
      headers.Authorization = `Bearer ${platform.token}`;
    } else {
      headers.indiatoken = platform.token;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      // @ts-ignore node-fetch signal typing
      signal: AbortSignal.timeout(getRequestTimeoutMs(platform)),
    });

    if (!res.ok) {
      if (attempt < 3) {
        logger.warn(
          { platform: platform.id, page, attempt, status: res.status },
          'Fetch returned error status, retrying',
        );
        await sleep(300);
        return fetchSinglePage(platform, page, attempt + 1);
      }

      return { rawRows: [], error: `HTTP ${res.status}` };
    }

    const text = await res.text();
    logger.trace(
      {
        platform: platform.id,
        page,
        textLength: text.length,
        snippet: text.substring(0, 500),
      },
      'Raw API response received',
    );

    const body = JSON.parse(text) as RawOrderResponse;
    const extracted = extractOrders(body);

    if (extracted.length === 0) {
      logger.warn(
        { platform: platform.id, page, snippet: text.substring(0, 1000) },
        'No orders extracted from response body',
      );
    }

    return { rawRows: extracted };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    if (attempt < 3) {
      logger.warn(
        { platform: platform.id, page, attempt, error },
        'Fetch failed, retrying',
      );
      await sleep(300);
      return fetchSinglePage(platform, page, attempt + 1);
    }

    return { rawRows: [], error };
  }
}

function getFetchPageBatchSize(maxPages: number): number {
  const configured = Number(process.env.FETCH_PAGE_BATCH_SIZE ?? 25);
  if (!Number.isFinite(configured) || configured < 1) {
    return Math.min(25, maxPages);
  }

  return Math.min(Math.floor(configured), maxPages);
}

function getPlatformMaxPages(platform: PlatformConfig): number {
  const override = Number(process.env.PLATFORM_MAX_PAGES_OVERRIDE ?? 0);
  if (Number.isFinite(override) && override > 0) {
    return Math.floor(override);
  }

  return platform.maxPages;
}

function normalisePageOrders(
  rawRows: RawOrder[],
  platformId: string,
  minAmount: number,
  seenKeys: Set<string>,
  knownOrderKeys: Set<string>,
): NormalisedPageResult {
  const orders: Order[] = [];
  let newestCrtDate: number | null = null;
  let oldestCrtDate: number | null = null;
  let duplicateCount = 0;
  let knownCount = 0;

  for (const raw of rawRows) {
    const order = normaliseOrder(raw, platformId);
    if (!order) continue;

    if (order.crtDate > 0) {
      newestCrtDate = newestCrtDate === null
        ? order.crtDate
        : Math.max(newestCrtDate, order.crtDate);
      oldestCrtDate = oldestCrtDate === null
        ? order.crtDate
        : Math.min(oldestCrtDate, order.crtDate);
    }

    if (order.amount < minAmount) {
      logger.debug(
        { platformId, amount: order.amount, minAmount },
        'Order rejected: below MIN_AMOUNT',
      );
      continue;
    }

    const dedupeKey = order.orderNo || order.rptNo || '';
    if (!dedupeKey) {
      duplicateCount += 1;
      continue;
    }

    if (seenKeys.has(dedupeKey)) {
      duplicateCount += 1;
      continue;
    }

    if (knownOrderKeys.has(dedupeKey)) {
      knownCount += 1;
      continue;
    }

    seenKeys.add(dedupeKey);
    orders.push(order);
  }

  orders.sort((left, right) => {
    if (right.crtDate !== left.crtDate) {
      return right.crtDate - left.crtDate;
    }

    return right.orderNo.localeCompare(left.orderNo);
  });

  return {
    orders,
    newestCrtDate,
    oldestCrtDate,
    duplicateCount,
    knownCount,
  };
}

export async function scanPlatformOrders(
  platform: PlatformConfig,
  onOrders: OrdersBatchHandler,
  onProgress?: (platformId: string, page: number, count: number) => void,
  options?: ScanPlatformOrdersOptions,
): Promise<ScanPlatformOrdersResult> {
  const seenKeys = new Set<string>();
  const minAmount = Number(process.env.MIN_AMOUNT ?? 9000);
  const maxPages = getPlatformMaxPages(platform);
  const batchSize = getFetchPageBatchSize(maxPages);
  const knownOrderKeys = options?.knownOrderKeys ?? new Set<string>();
  const lastSeenCrtDate = Math.max(0, options?.lastSeenCrtDate ?? 0);
  const lookbackSeconds = getLookbackSeconds(platform, options);
  const stalePageThreshold = getStalePageThreshold(platform, options);
  const staleCutoff = lastSeenCrtDate > 0
    ? Math.max(0, lastSeenCrtDate - lookbackSeconds)
    : 0;

  let totalOrders = 0;
  let scannedPages = 0;
  let newestOrderCrtDate: number | null = lastSeenCrtDate > 0 ? lastSeenCrtDate : null;
  let stalePagesInRow = 0;

  outer: for (let startPage = 1; startPage <= maxPages; startPage += batchSize) {
    const pages = Array.from(
      { length: Math.min(batchSize, maxPages - startPage + 1) },
      (_, index) => startPage + index,
    );
    const results = await Promise.all(pages.map(page => fetchSinglePage(platform, page)));

    let chunkHadRows = false;
    let reachedLastPage = false;

    for (let index = 0; index < results.length; index += 1) {
      const page = pages[index];
      const result = results[index];

      if (page === undefined || result === undefined) {
        continue;
      }

      scannedPages += 1;

      const { rawRows, error } = result;

      if (error) {
        logger.warn({ platform: platform.id, page, error }, 'Fetch error');
        continue;
      }

      if (rawRows.length === 0) {
        reachedLastPage = true;
        continue;
      }

      chunkHadRows = true;

      if (rawRows.length < platform.pageSize) {
        reachedLastPage = true;
      }

      const pageResult = normalisePageOrders(
        rawRows,
        platform.id,
        minAmount,
        seenKeys,
        knownOrderKeys,
      );

      if (
        pageResult.newestCrtDate !== null
        && (newestOrderCrtDate === null || pageResult.newestCrtDate > newestOrderCrtDate)
      ) {
        newestOrderCrtDate = pageResult.newestCrtDate;
      }

      onProgress?.(platform.id, page, pageResult.orders.length);

      if (pageResult.orders.length > 0) {
        stalePagesInRow = 0;
        totalOrders += pageResult.orders.length;
        await onOrders(pageResult.orders, {
          page,
          rawCount: rawRows.length,
          totalOrders,
        });
        continue;
      }

      const pageIsStale = staleCutoff > 0
        && pageResult.newestCrtDate !== null
        && pageResult.newestCrtDate < staleCutoff;

      if (pageIsStale) {
        stalePagesInRow += 1;
        logger.debug(
          {
            platform: platform.id,
            page,
            stalePagesInRow,
            newestCrtDate: pageResult.newestCrtDate,
            staleCutoff,
            duplicateCount: pageResult.duplicateCount,
            knownCount: pageResult.knownCount,
          },
          'Stopping scan early on stale/known pages',
        );

        if (stalePagesInRow >= stalePageThreshold) {
          break outer;
        }
      } else {
        stalePagesInRow = 0;
      }
    }

    if (!chunkHadRows || reachedLastPage) {
      break;
    }
  }

  if (totalOrders > 0) {
    logger.info(
      { platform: platform.id, total: totalOrders, scannedPages },
      'Bulk fetch complete',
    );
  }

  return {
    totalOrders,
    scannedPages,
    newestOrderCrtDate,
  };
}

export async function fetchAllPages(
  platform: PlatformConfig,
  onProgress?: (platformId: string, page: number, count: number) => void,
  options?: ScanPlatformOrdersOptions,
): Promise<Order[]> {
  const allOrders: Order[] = [];

  await scanPlatformOrders(
    platform,
    (orders) => {
      allOrders.push(...orders);
    },
    onProgress,
    options,
  );

  return allOrders;
}
