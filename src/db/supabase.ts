// ============================================================
// Supabase Client + Cached Account Loader
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { buildAccountMatchIndex } from '../matcher/matchOrder.js';
import { logger } from '../utils/logger.js';
import type { AccountSnapshot, DbAccount } from '../types/index.js';

interface BankDataRow {
  id: string;
  bank_name: string | null;
  holder_name: string | null;
  account_number: string;
  ifsc_code: string;
  mobile_number: string | null;
  pincode: string | null;
  location: string | null;
  additional_name: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  agent_id: string | null;
  agent_name: string | null;
  subagent_id: string | null;
  subagent_name: string | null;
  referrer_id: string | null;
  referrer_name: string | null;
  is_used: boolean;
  is_duplicate: boolean;
  duplicate_of: string | null;
  uploaded_at: string | null;
  updated_at: string | null;
}

function mapRow(row: BankDataRow): DbAccount {
  return {
    id: row.id,
    acctNo: row.account_number?.trim() ?? '',
    ifsc: row.ifsc_code?.trim() ?? '',
    name: row.holder_name ?? row.additional_name ?? undefined,
    bankName: row.bank_name,
    mobileNumber: row.mobile_number,
    location: row.location,
    subagentId: row.subagent_id,
    subagentName: row.subagent_name,
    agentId: row.agent_id,
    agentName: row.agent_name,
    uploadedBy: row.uploaded_by,
    isUsed: row.is_used,
    isDuplicate: row.is_duplicate,
  };
}

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL and one Supabase key must be set in .env');
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });

  logger.info({
    authMode: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon',
  }, 'Supabase client initialised');

  return _client;
}

let cache: AccountSnapshot | null = null;
let inFlightSnapshot: Promise<AccountSnapshot> | null = null;
let refreshInterval: NodeJS.Timeout | null = null;

const DB_REFRESH_MS = (): number =>
  Number(process.env.DB_REFRESH_INTERVAL_MS ?? 60_000);

const TABLE_NAME = (): string =>
  process.env.ACCOUNTS_TABLE ?? 'bank_data';

const TARGET_SUBAGENT_ID = (): string | null =>
  process.env.TARGET_SUBAGENT_ID ?? null;

const MATCH_ALL = (): boolean =>
  (process.env.MATCH_ALL_RECORDS ?? 'false').toLowerCase() === 'true';

export function getSyncAccountSnapshot(): AccountSnapshot | null {
  return cache;
}

export function startBackgroundDbRefresh(): void {
  if (refreshInterval) return;
  
  refreshInterval = setInterval(() => {
    void loadAccountSnapshot();
  }, DB_REFRESH_MS());
  
  logger.info({ intervalMs: DB_REFRESH_MS() }, 'Background DB refresh started');
}

export async function loadAccountSnapshot(): Promise<AccountSnapshot> {
  const now = Date.now();

  if (inFlightSnapshot) {
    return inFlightSnapshot;
  }

  inFlightSnapshot = (async () => {
    try {
      const supabase = getSupabaseClient();
      const table = TABLE_NAME();
      const matchAll = MATCH_ALL();
      const targetId = TARGET_SUBAGENT_ID();

      let query = supabase
        .from(table)
        .select(
          'id, bank_name, holder_name, account_number, ifsc_code, ' +
          'mobile_number, pincode, location, additional_name, ' +
          'uploaded_by, uploaded_by_name, agent_id, agent_name, ' +
          'subagent_id, subagent_name, referrer_id, referrer_name, ' +
          'is_used, is_duplicate, duplicate_of, uploaded_at, updated_at'
        );

      if (!matchAll && targetId) {
        query = query.or(
          `subagent_id.eq.${targetId},uploaded_by.eq.${targetId}`
        );
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Supabase query error: ${error.message}`);
      }

      const rows = (data ?? []) as unknown as BankDataRow[];
      const accounts = rows
        .filter(row => row.account_number && row.ifsc_code)
        .map(mapRow);

      cache = {
        accounts,
        matchIndex: buildAccountMatchIndex(accounts),
        fetchedAt: now,
      };

      return cache;
    } catch (err) {
      if (cache) {
        logger.warn({ err }, 'Supabase background refresh failed - using stale cache');
        return cache;
      }
      logger.error({ err }, 'Supabase initial load failed');
      throw err;
    } finally {
      inFlightSnapshot = null;
    }
  })();

  return inFlightSnapshot;
}

export async function loadAccounts(): Promise<DbAccount[]> {
  const snapshot = await loadAccountSnapshot();
  return snapshot.accounts;
}

export function stopBackgroundDbRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

export function invalidateCache(): void {
  if (cache) {
    cache.fetchedAt = 0;
  }
}
