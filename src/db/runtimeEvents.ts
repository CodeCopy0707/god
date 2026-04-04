import { getSupabaseClient } from './supabase.js';
import { logger } from '../utils/logger.js';
import type { ObservedOrderEvent } from '../types/index.js';

type StorageState = 'ready' | 'missing_table' | 'write_error' | 'runtime_only';

interface OrderEventRow {
  event_key: string;
  platform: string;
  order_no: string;
  rpt_no: string | null;
  acct_no: string;
  acct_code: string;
  acct_name: string | null;
  amount: number;
  real_amount: number | null;
  reward: number | null;
  order_state: number;
  crt_date: number;
  user_id: string | null;
  received_at: string;
  matched: boolean;
  matched_at: string | null;
  matched_account_id: string | null;
  matched_account_no: string | null;
  matched_ifsc: string | null;
  matched_holder_name: string | null;
  matched_bank_name: string | null;
  matched_subagent_id: string | null;
  matched_subagent_name: string | null;
}

const EVENTS_TABLE = (): string =>
  process.env.RUNTIME_EVENTS_TABLE ?? 'matcher_order_events';

let storageState: StorageState = 'ready';
let missingTableLogged = false;

function isPersistenceEnabled(): boolean {
  return process.env.DISABLE_RUNTIME_EVENT_STORAGE !== 'true';
}

function isMissingTableError(message: string): boolean {
  const normalised = message.toLowerCase();
  return normalised.includes('does not exist')
    || normalised.includes('could not find the table')
    || normalised.includes('relation')
    || normalised.includes('schema cache');
}

function mapEventToRow(event: ObservedOrderEvent): OrderEventRow {
  return {
    event_key: event.eventKey,
    platform: event.platform,
    order_no: event.orderNo,
    rpt_no: event.rptNo ?? null,
    acct_no: event.acctNo,
    acct_code: event.acctCode,
    acct_name: event.acctName || null,
    amount: event.amount,
    real_amount: event.realAmount ?? null,
    reward: event.reward ?? null,
    order_state: event.orderState,
    crt_date: event.crtDate,
    user_id: event.userId ?? null,
    received_at: event.receivedAt,
    matched: event.matched,
    matched_at: event.matchedAt ?? null,
    matched_account_id: event.matchedAccountId ?? null,
    matched_account_no: event.matchedAccountNo ?? null,
    matched_ifsc: event.matchedIfsc ?? null,
    matched_holder_name: event.matchedHolderName ?? null,
    matched_bank_name: event.matchedBankName ?? null,
    matched_subagent_id: event.matchedSubagentId ?? null,
    matched_subagent_name: event.matchedSubagentName ?? null,
  };
}

function mapRowToEvent(row: Partial<OrderEventRow>): ObservedOrderEvent | null {
  if (!row.event_key || !row.platform || !row.order_no || !row.acct_no || !row.acct_code) {
    return null;
  }

  return {
    eventKey: row.event_key,
    platform: row.platform,
    orderNo: row.order_no,
    rptNo: row.rpt_no ?? undefined,
    acctNo: row.acct_no,
    acctCode: row.acct_code,
    acctName: row.acct_name ?? '',
    amount: Number(row.amount ?? 0),
    realAmount: row.real_amount ?? undefined,
    reward: row.reward ?? undefined,
    orderState: Number(row.order_state ?? 0),
    crtDate: Number(row.crt_date ?? 0),
    userId: row.user_id ?? undefined,
    receivedAt: row.received_at ?? new Date().toISOString(),
    matched: Boolean(row.matched),
    matchedAt: row.matched_at ?? undefined,
    matchedAccountId: row.matched_account_id ?? undefined,
    matchedAccountNo: row.matched_account_no ?? undefined,
    matchedIfsc: row.matched_ifsc ?? undefined,
    matchedHolderName: row.matched_holder_name ?? undefined,
    matchedBankName: row.matched_bank_name ?? undefined,
    matchedSubagentId: row.matched_subagent_id ?? undefined,
    matchedSubagentName: row.matched_subagent_name ?? undefined,
  };
}

async function upsertEvents(events: ObservedOrderEvent[]): Promise<void> {
  if (!isPersistenceEnabled()) {
    storageState = 'runtime_only';
    return;
  }

  if (storageState === 'missing_table') {
    return;
  }

  const rows = events.map(mapEventToRow);
  const table = EVENTS_TABLE();

  const { error } = await getSupabaseClient()
    .from(table)
    .upsert(rows, {
      onConflict: 'event_key',
      ignoreDuplicates: false,
    });

  if (!error) {
    storageState = 'ready';
    return;
  }

  if (isMissingTableError(error.message)) {
    storageState = 'missing_table';
    if (!missingTableLogged) {
      missingTableLogged = true;
      logger.warn(
        { table, error: error.message },
        'Runtime event table missing - dashboard will use runtime memory until table is created',
      );
    }
    return;
  }

  storageState = 'write_error';
  logger.warn({ table, error: error.message }, 'Failed to persist runtime events');
}

export async function persistObservedOrderEvents(
  events: ObservedOrderEvent[],
): Promise<void> {
  if (events.length === 0) return;
  await upsertEvents(events);
}

export async function persistMatchedOrderEvent(
  event: ObservedOrderEvent,
): Promise<void> {
  await upsertEvents([event]);
}

export async function listPersistedOrderEvents(
  limit = 100,
  matchedOnly = false,
): Promise<ObservedOrderEvent[]> {
  if (!isPersistenceEnabled() || storageState === 'missing_table') {
    return [];
  }

  const table = EVENTS_TABLE();
  let query = getSupabaseClient()
    .from(table)
    .select('*')
    .order(matchedOnly ? 'matched_at' : 'received_at', { ascending: false })
    .limit(limit);

  if (matchedOnly) {
    query = query.eq('matched', true);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingTableError(error.message)) {
      storageState = 'missing_table';
      return [];
    }

    logger.warn({ table, error: error.message }, 'Failed to read persisted runtime events');
    return [];
  }

  return (data ?? [])
    .map(row => mapRowToEvent(row as Partial<OrderEventRow>))
    .filter((event): event is ObservedOrderEvent => event !== null);
}

export function getRuntimeEventStorageInfo(): {
  enabled: boolean;
  mode: 'supabase' | 'runtime';
  table: string;
  state: StorageState;
} {
  return {
    enabled: isPersistenceEnabled(),
    mode: isPersistenceEnabled() && storageState === 'ready' ? 'supabase' : 'runtime',
    table: EVENTS_TABLE(),
    state: storageState,
  };
}
