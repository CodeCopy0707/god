// ============================================================
// API Fetch Module — Fetches and normalises orders per platform
// ============================================================

import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import type { PlatformConfig, Order, RawOrderResponse, RawOrder } from '../types/index.js';

// ── Normalise a raw API row → typed Order ──────────────────────────────────
function normaliseOrder(raw: RawOrder, platformId: string): Order | null {
  try {
    const orderNo  = String(raw.orderNo  ?? raw.order_no  ?? '').trim();
    const acctNo   = String(raw.acctNo   ?? raw.acct_no   ?? '').trim();
    const acctCode = String(raw.acctCode ?? raw.acct_code ?? '').trim();
    const acctName = String(raw.acctName ?? raw.acct_name ?? '').trim();
    const amount   = Number(raw.amount   ?? 0);
    const crtDate  = Number(raw.crtDate  ?? raw.crt_date  ?? 0);

    if (!orderNo || !acctNo || !acctCode) return null;

    return {
      platform:    platformId,
      orderNo,
      rptNo:       raw.rptNo ? String(raw.rptNo) : (raw.rpt_no ? String(raw.rpt_no) : undefined),
      acctNo,
      acctCode,
      acctName,
      amount,
      realAmount:  raw.realAmount !== undefined ? Number(raw.realAmount)
                 : raw.real_amount !== undefined ? Number(raw.real_amount)
                 : undefined,
      reward:      raw.reward !== undefined ? Number(raw.reward) : undefined,
      orderState:  Number(raw.orderState ?? raw.order_state ?? 0),
      crtDate,
      userId:      raw.userId ? String(raw.userId)
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
  if (Array.isArray(body.data?.list))    return body.data!.list!;
  if (Array.isArray(body.data?.records)) return body.data!.records!;
  if (Array.isArray(body.data?.rows))    return body.data!.rows!;
  if (Array.isArray(body.list))          return body.list!;
  if (Array.isArray(body.records))       return body.records!;
  return [];
}

// ── Build query params for a given page ───────────────────────────────────
function buildUrl(baseUrl: string, page: number, pageSize: number): string {
  const params = new URLSearchParams({
    page:       String(page),
    limit:      String(pageSize),
    if_asc:     'false',
    min_amount: String(Number(process.env.MIN_AMOUNT ?? 5000)),
    max_amount: '100000000',
    method:     '1',
    date_asc:   '1',
  });
  return `${baseUrl}?${params.toString()}`;
}

// ── Fetch all pages for a platform ────────────────────────────────────────
export async function fetchAllPages(platform: PlatformConfig): Promise<Order[]> {
  const allOrders: Order[]    = [];
  const seenKeys  = new Set<string>();
  const minAmount = Number(process.env.MIN_AMOUNT ?? 5000);

  for (let page = 1; page <= platform.maxPages; page++) {
    const url = buildUrl(platform.baseUrl, page, platform.pageSize);

    let body: RawOrderResponse;
    try {
      const res = await fetch(url, {
        method:  'GET',
        headers: {
          'Accept':       'application/json',
          'Content-Type': 'application/json',
          'indiatoken':   platform.token,
          ...platform.headers,
        },
        // @ts-ignore — node-fetch signal typing
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        logger.warn({ platform: platform.id, page, status: res.status },
          'Non-OK HTTP response, stopping pagination');
        break;
      }

      const text = await res.text();
      try {
        body = JSON.parse(text) as RawOrderResponse;
      } catch {
        logger.warn({ platform: platform.id, page }, 'Failed to parse JSON response');
        break;
      }
    } catch (err) {
      logger.error({ platform: platform.id, page, err }, 'Fetch error');
      break;
    }

    const rawRows = extractOrders(body);

    if (rawRows.length === 0) {
      logger.debug({ platform: platform.id, page }, 'Empty page — stopping pagination');
      break;
    }

    for (const raw of rawRows) {
      const order = normaliseOrder(raw, platform.id);
      if (!order) continue;
      if (order.amount < minAmount) continue;

      // Deduplicate on orderNo | rptNo
      const dedupeKey = order.orderNo || order.rptNo || '';
      if (!dedupeKey || seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      allOrders.push(order);
    }

    // If fewer results than pageSize were returned, this is the last page
    if (rawRows.length < platform.pageSize) {
      logger.debug({ platform: platform.id, page }, 'Partial page — stopping pagination');
      break;
    }
  }

  logger.debug({ platform: platform.id, count: allOrders.length }, 'Fetch complete');
  return allOrders;
}
