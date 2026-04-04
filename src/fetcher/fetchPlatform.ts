// ============================================================
// API Fetch Module - Fetches and normalises orders per platform
// ============================================================

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
  totalOrders: number;
}

type OrdersBatchHandler = (
  orders: Order[],
  meta: OrderBatchMeta,
) => Promise<void> | void;

function normaliseOrder(raw: RawOrder, platformId: string): Order | null {
  try {
    const orderNo = String(raw.orderNo ?? raw.order_no ?? '').trim();
    const acctCode = String(raw.acctCode ?? raw.acct_code ?? raw.ifsc ?? '').trim();
    const acctName = String(
      raw.acctName ?? raw.acct_name ?? raw.account_name ?? raw.name ?? ''
    ).trim();
    const acctNo = String(
      raw.acctNo ?? raw.acct_no ?? raw.upi_account ?? raw.upi ?? ''
    ).trim();
    const amount = Number(raw.amount ?? 0);

    let crtDate = Number(raw.crtDate ?? raw.crt_date ?? 0);
    if (!crtDate && raw.created_at) {
      const parsed = Date.parse(String(raw.created_at));
      if (!isNaN(parsed)) crtDate = Math.floor(parsed / 1000);
    }

    if (!orderNo || !acctNo || !acctCode) return null;

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
  if (body.code !== undefined && body.code !== 0) return [];

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
    min_amount: String(Number(process.env.MIN_AMOUNT ?? 5000)),
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
      // @ts-ignore - node-fetch signal typing
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return { rawRows: [], error: `HTTP ${res.status}` };
    }

    const text = await res.text();
    const body = JSON.parse(text) as RawOrderResponse;

    return { rawRows: extractOrders(body) };
  } catch (err: any) {
    return { rawRows: [], error: err.message };
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
): Order[] {
  const orders: Order[] = [];

  for (const raw of rawRows) {
    const order = normaliseOrder(raw, platformId);
    if (!order) continue;
    if (order.amount < minAmount) continue;

    const dedupeKey = order.orderNo || order.rptNo || '';
    if (!dedupeKey || seenKeys.has(dedupeKey)) continue;

    seenKeys.add(dedupeKey);
    orders.push(order);
  }

  return orders;
}

export async function scanPlatformOrders(
  platform: PlatformConfig,
  onOrders: OrdersBatchHandler,
  onProgress?: (platformId: string, page: number, count: number) => void,
): Promise<number> {
  const seenKeys = new Set<string>();
  const minAmount = Number(process.env.MIN_AMOUNT ?? 5000);
  const maxPages = getPlatformMaxPages(platform);
  const batchSize = getFetchPageBatchSize(maxPages);
  let totalOrders = 0;

  for (let startPage = 1; startPage <= maxPages; startPage += batchSize) {
    const pages = Array.from(
      { length: Math.min(batchSize, maxPages - startPage + 1) },
      (_, index) => startPage + index,
    );

    const results = await Promise.all(
      pages.map(page => fetchSinglePage(platform, page)),
    );

    let chunkHadRows = false;
    let reachedLastPage = false;

    for (let index = 0; index < results.length; index++) {
      const page = pages[index];
      const result = results[index];

      if (page === undefined || !result) continue;

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

      const orders = normalisePageOrders(
        rawRows,
        platform.id,
        minAmount,
        seenKeys,
      );

      if (orders.length === 0) continue;

      totalOrders += orders.length;
      onProgress?.(platform.id, page, orders.length);
      await onOrders(orders, { page, totalOrders });
    }

    if (!chunkHadRows || reachedLastPage) {
      break;
    }
  }

  if (totalOrders > 0) {
    logger.info({ platform: platform.id, total: totalOrders }, 'Bulk fetch complete');
  }

  return totalOrders;
}

export async function fetchAllPages(
  platform: PlatformConfig,
  onProgress?: (platformId: string, page: number, count: number) => void,
): Promise<Order[]> {
  const allOrders: Order[] = [];

  await scanPlatformOrders(
    platform,
    (orders) => {
      allOrders.push(...orders);
    },
    onProgress,
  );

  return allOrders;
}
