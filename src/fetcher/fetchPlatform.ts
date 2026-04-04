// ============================================================
// API Fetch Module — Fetches and normalises orders per platform
// ============================================================

import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import type { PlatformConfig, Order, RawOrderResponse, RawOrder } from '../types/index.js';

// ── Normalise a raw API row → typed Order ──────────────────────────────────
function normaliseOrder(raw: RawOrder, platformId: string): Order | null {
  try {
    const orderNo = String(raw.orderNo ?? raw.order_no ?? '').trim();
    const acctCode = String(raw.acctCode ?? raw.acct_code ?? raw.ifsc ?? '').trim();
    const acctName = String(raw.acctName ?? raw.acct_name ?? raw.account_name ?? raw.name ?? '').trim();
    const acctNo = String(raw.acctNo ?? raw.acct_no ?? raw.upi_account ?? raw.upi ?? '').trim();
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
      rptNo: raw.rptNo ? String(raw.rptNo) : (raw.rpt_no ? String(raw.rpt_no) : undefined),
      acctNo,
      acctCode,
      acctName,
      amount,
      realAmount: raw.realAmount !== undefined ? Number(raw.realAmount)
        : raw.real_amount !== undefined ? Number(raw.real_amount)
          : undefined,
      reward: raw.reward !== undefined ? Number(raw.reward) : undefined,
      orderState: Number(raw.orderState ?? raw.order_state ?? raw.status ?? 0),
      crtDate,
      userId: raw.userId ? String(raw.userId)
        : raw.user_id ? String(raw.user_id)
          : undefined,
    };
  } catch (err) {
    logger.warn({ err, raw }, 'Failed to normalise order');
    return null;
  }
}

// ── Extract order list from various response shapes ───────────────────────
function extractOrders(body: RawOrderResponse): RawOrder[] {
  // Check if result is success (modern APIs often use code: 0)
  if (body.code !== undefined && body.code !== 0) return [];

  if (Array.isArray(body.data?.products)) return body.data!.products!;
  if (Array.isArray(body.data?.list)) return body.data!.list!;
  if (Array.isArray(body.data?.records)) return body.data!.records!;
  if (Array.isArray(body.data?.rows)) return body.data!.rows!;
  if (Array.isArray(body.list)) return body.list!;
  if (Array.isArray(body.records)) return body.records!;
  return [];
}

// ── Build query params for a given page ───────────────────────────────────
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

  // Modern specific default
  if (isModern) {
    params.type = 'max';
    params.sort_by = 'desc';
  }

  // Override with custom params
  if (platform.customParams) {
    Object.assign(params, platform.customParams);
  }

  const searchParams = new URLSearchParams(params);
  return `${platform.baseUrl}?${searchParams.toString()}`;
}

// ── Fetch a single page from a platform ────────────────────────────────────
async function fetchSinglePage(
  platform: PlatformConfig,
  page: number,
  minAmount: number,
): Promise<{ rawRows: RawOrder[]; error?: string }> {
  const url = buildUrl(platform, page);

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...platform.headers,
      ...platform.customHeaders,
    };

    if (platform.useBearerAuth) {
      headers['Authorization'] = `Bearer ${platform.token}`;
    } else {
      headers['indiatoken'] = platform.token;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      // @ts-ignore — node-fetch signal typing
      signal: AbortSignal.timeout(15_000), // Increased timeout slightly for reliable parallel fetches
    });

    if (!res.ok) {
      return { rawRows: [], error: `HTTP ${res.status}` };
    }

    const text = await res.text();
    const body = JSON.parse(text) as RawOrderResponse;
    const rawRows = extractOrders(body);

    return { rawRows };
  } catch (err: any) {
    return { rawRows: [], error: err.message };
  }
}

// ── Fetch all pages for a platform in parallel ──────────────────────────────
export async function fetchAllPages(
  platform: PlatformConfig,
  onProgress?: (platformId: string, page: number, count: number) => void
): Promise<Order[]> {
  const allOrders: Order[] = [];
  const seenKeys = new Set<string>();
  const minAmount = Number(process.env.MIN_AMOUNT ?? 5000);

  // We fetch up to platform.maxPages in parallel for maximum speed
  const pageNumbers = Array.from({ length: platform.maxPages }, (_, i) => i + 1);

  const results = await Promise.all(
    pageNumbers.map(page => fetchSinglePage(platform, page, minAmount))
  );

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (!res) continue;

    const { rawRows, error } = res;
    const page = pageNumbers[i];
    if (page === undefined) continue;

    if (error) {
      logger.warn({ platform: platform.id, page, error }, 'Fetch error');
      continue;
    }

    if (rawRows.length === 0) continue;

    let pageValidCount = 0;
    for (const raw of rawRows) {
      const order = normaliseOrder(raw, platform.id);
      if (!order) continue;
      if (order.amount < minAmount) continue;

      // Deduplicate on orderNo | rptNo
      const dedupeKey = order.orderNo || order.rptNo || '';
      if (!dedupeKey || seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      allOrders.push(order);
      pageValidCount++;
    }

    if (onProgress && pageValidCount > 0) {
      onProgress(platform.id, page, pageValidCount);
    }
  }

  if (allOrders.length > 0) {
    logger.info({ platform: platform.id, total: allOrders.length }, '🚀 Bulk fetch complete');
  }

  return allOrders;
}
