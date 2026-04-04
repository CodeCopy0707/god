import { EventEmitter } from 'node:events';
import type { DbAccount, ObservedOrderEvent, Order } from '../types/index.js';
import {
  listPersistedOrderEvents,
  persistMatchedOrderEvent,
  persistObservedOrderEvents,
} from '../db/runtimeEvents.js';

const emitter = new EventEmitter();

const recentOrders: ObservedOrderEvent[] = [];
const recentMatches: ObservedOrderEvent[] = [];

let totalObservedOrders = 0;
let totalMatchedOrders = 0;

const MAX_RECENT_ORDERS = (): number =>
  Number(process.env.DASHBOARD_RECENT_ORDERS_LIMIT ?? 250);

const MAX_RECENT_MATCHES = (): number =>
  Number(process.env.DASHBOARD_RECENT_MATCHES_LIMIT ?? 250);

function buildEventKey(order: Order): string {
  return `${order.platform}:${order.orderNo}`;
}

function trimFeed(feed: ObservedOrderEvent[], maxItems: number): void {
  if (feed.length > maxItems) {
    feed.length = maxItems;
  }
}

function pushOrReplace(
  feed: ObservedOrderEvent[],
  event: ObservedOrderEvent,
  maxItems: number,
): void {
  const existingIndex = feed.findIndex(item => item.eventKey === event.eventKey);
  if (existingIndex >= 0) {
    feed.splice(existingIndex, 1);
  }

  feed.unshift(event);
  trimFeed(feed, maxItems);
}

export function emitDashboardRefresh(): void {
  emitter.emit('refresh', {
    at: new Date().toISOString(),
  });
}

export function subscribeDashboardRefresh(
  listener: (payload: { at: string }) => void,
): () => void {
  emitter.on('refresh', listener);
  return () => {
    emitter.off('refresh', listener);
  };
}

export function recordObservedOrders(orders: Order[]): void {
  if (orders.length === 0) return;

  const receivedAt = new Date().toISOString();
  const events: ObservedOrderEvent[] = orders.map(order => ({
    eventKey: buildEventKey(order),
    platform: order.platform,
    orderNo: order.orderNo,
    rptNo: order.rptNo,
    acctNo: order.acctNo,
    acctCode: order.acctCode,
    acctName: order.acctName,
    amount: order.amount,
    realAmount: order.realAmount,
    reward: order.reward,
    orderState: order.orderState,
    crtDate: order.crtDate,
    userId: order.userId,
    receivedAt,
    matched: false,
  }));

  totalObservedOrders += events.length;

  for (const event of events) {
    pushOrReplace(recentOrders, event, MAX_RECENT_ORDERS());
  }

  emitDashboardRefresh();
  void persistObservedOrderEvents(events);
}

export function recordMatchedOrder(
  order: Order,
  matchedAccount: DbAccount,
): void {
  const matchedAt = new Date().toISOString();
  const event: ObservedOrderEvent = {
    eventKey: buildEventKey(order),
    platform: order.platform,
    orderNo: order.orderNo,
    rptNo: order.rptNo,
    acctNo: order.acctNo,
    acctCode: order.acctCode,
    acctName: order.acctName,
    amount: order.amount,
    realAmount: order.realAmount,
    reward: order.reward,
    orderState: order.orderState,
    crtDate: order.crtDate,
    userId: order.userId,
    receivedAt: matchedAt,
    matched: true,
    matchedAt,
    matchedAccountId: matchedAccount.id,
    matchedAccountNo: matchedAccount.acctNo,
    matchedIfsc: matchedAccount.ifsc,
    matchedHolderName: matchedAccount.name,
    matchedBankName: matchedAccount.bankName ?? undefined,
    matchedSubagentId: matchedAccount.subagentId ?? undefined,
    matchedSubagentName: matchedAccount.subagentName ?? undefined,
  };

  totalMatchedOrders += 1;
  pushOrReplace(recentMatches, event, MAX_RECENT_MATCHES());
  pushOrReplace(recentOrders, event, MAX_RECENT_ORDERS());

  emitDashboardRefresh();
  void persistMatchedOrderEvent(event);
}

export async function getOrderFeed(limit = 100): Promise<ObservedOrderEvent[]> {
  const persisted = await listPersistedOrderEvents(limit, false);
  if (persisted.length > 0) {
    return persisted;
  }

  return recentOrders.slice(0, limit);
}

export async function getMatchFeed(limit = 100): Promise<ObservedOrderEvent[]> {
  const persisted = await listPersistedOrderEvents(limit, true);
  if (persisted.length > 0) {
    return persisted;
  }

  return recentMatches.slice(0, limit);
}

export function getDashboardCounters(): {
  totalObservedOrders: number;
  totalMatchedOrders: number;
} {
  return {
    totalObservedOrders,
    totalMatchedOrders,
  };
}
