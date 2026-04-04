// ============================================================
// Matching Engine — IFSC prefix (4 chars) + last-4 acctNo
// ============================================================

import type { Order, DbAccount } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Match an order against a list of DB accounts.
 *
 * BOTH conditions must be true:
 *  1. Last 4 digits of account number match
 *  2. First 4 characters of IFSC match (identifies the BANK, not branch)
 *
 * Returns the first matching DbAccount, or null if no match.
 */
export function matchOrder(order: Order, dbAccounts: DbAccount[]): DbAccount | null {
  try {
    const orderAcctLast4  = order.acctNo.trim().slice(-4);
    const orderIfscPrefix = order.acctCode.trim().toUpperCase().slice(0, 4);

    if (!orderAcctLast4 || orderAcctLast4.length < 4) return null;
    if (!orderIfscPrefix || orderIfscPrefix.length < 4) return null;

    for (const account of dbAccounts) {
      try {
        const dbAcctLast4  = account.acctNo.trim().slice(-4);
        const dbIfscPrefix = account.ifsc.trim().toUpperCase().slice(0, 4);

        const acctMatch = orderAcctLast4 === dbAcctLast4;
        const ifscMatch = orderIfscPrefix === dbIfscPrefix;

        if (acctMatch && ifscMatch) {
          logger.debug({
            orderNo:    order.orderNo,
            platform:   order.platform,
            acctLast4:  orderAcctLast4,
            ifscPrefix: orderIfscPrefix,
            dbId:       account.id,
          }, 'Order matched');
          return account;
        }
      } catch (innerErr) {
        logger.warn({ innerErr, accountId: account.id },
          'Error comparing individual account, skipping');
        continue;
      }
    }

    return null;
  } catch (err) {
    logger.error({ err, orderNo: order.orderNo }, 'matchOrder threw unexpectedly');
    return null;
  }
}
