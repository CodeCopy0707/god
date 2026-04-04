// ============================================================
// Matching Engine - IFSC prefix (4 chars) + last-4 acctNo
// ============================================================

import type {
  DbAccount,
  DbAccountMatchIndex,
  MatchKey,
  Order,
} from '../types/index.js';
import { logger } from '../utils/logger.js';

function normaliseAccountTail(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const digitsOnly = trimmed.replace(/\D/g, '');
  const source = digitsOnly.length >= 4
    ? digitsOnly
    : trimmed.replace(/\s+/g, '');

  return source.slice(-4);
}

function normaliseIfscPrefix(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase().slice(0, 4);
}

export function getMatchKey(acctNo: string, ifsc: string): MatchKey | null {
  const acctLast4 = normaliseAccountTail(acctNo);
  const ifscPrefix = normaliseIfscPrefix(ifsc);

  if (acctLast4.length < 4 || ifscPrefix.length < 4) {
    return null;
  }

  return `${ifscPrefix}|${acctLast4}`;
}

export function buildAccountMatchIndex(
  dbAccounts: DbAccount[],
): DbAccountMatchIndex {
  const matchIndex: DbAccountMatchIndex = new Map();

  for (const account of dbAccounts) {
    const key = getMatchKey(account.acctNo, account.ifsc);
    if (!key) continue;

    const bucket = matchIndex.get(key);
    if (bucket) {
      bucket.push(account);
    } else {
      matchIndex.set(key, [account]);
    }
  }

  logger.info({
    accounts: dbAccounts.length,
    matchBuckets: matchIndex.size,
  }, 'Account match index built');

  return matchIndex;
}

function pickBestMatch(candidates: DbAccount[]): DbAccount | null {
  if (candidates.length === 0) return null;

  return candidates.find(candidate => !candidate.isDuplicate)
    ?? candidates[0]
    ?? null;
}

export function matchOrder(
  order: Order,
  matchIndex: DbAccountMatchIndex,
): DbAccount | null {
  try {
    const key = getMatchKey(order.acctNo, order.acctCode);
    if (!key) return null;

    const candidates = matchIndex.get(key);
    if (!candidates || candidates.length === 0) {
      return null;
    }

    const match = pickBestMatch(candidates);
    if (!match) return null;

    logger.debug({
      orderNo: order.orderNo,
      platform: order.platform,
      matchKey: key,
      dbId: match.id,
      candidateCount: candidates.length,
    }, 'Order matched');

    return match;
  } catch (err) {
    logger.error({ err, orderNo: order.orderNo }, 'matchOrder threw unexpectedly');
    return null;
  }
}
