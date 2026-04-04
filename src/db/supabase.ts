// ============================================================
// Supabase Client + Cached Account Loader
// Table: bank_data
// Filter: subagent_id = TARGET_SUBAGENT_ID (Sukh6565)
// Column mapping:
//   account_number → acctNo
//   ifsc_code      → ifsc
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import type { DbAccount } from '../types/index.js';

// ── Raw row shape from the bank_data table ────────────────────────────────
interface BankDataRow {
  id:               string;
  bank_name:        string | null;
  holder_name:      string | null;
  account_number:   string;
  ifsc_code:        string;
  mobile_number:    string | null;
  pincode:          string | null;
  location:         string | null;
  additional_name:  string | null;
  uploaded_by:      string | null;
  uploaded_by_name: string | null;
  agent_id:         string | null;
  agent_name:       string | null;
  subagent_id:      string | null;
  subagent_name:    string | null;
  referrer_id:      string | null;
  referrer_name:    string | null;
  is_used:          boolean;
  is_duplicate:     boolean;
  duplicate_of:     string | null;
  uploaded_at:      string | null;
  updated_at:       string | null;
}

// ── Map DB row → DbAccount (normalise column names) ───────────────────────
function mapRow(row: BankDataRow): DbAccount {
  return {
    id:     row.id,
    acctNo: row.account_number?.trim() ?? '',   // account_number → acctNo
    ifsc:   row.ifsc_code?.trim() ?? '',         // ifsc_code      → ifsc
    name:   row.holder_name ?? row.additional_name ?? undefined,
    // Keep raw fields for reference in alerts
    bankName:    row.bank_name,
    mobileNumber: row.mobile_number,
    location:    row.location,
    subagentId:  row.subagent_id,
    subagentName: row.subagent_name,
    agentId:     row.agent_id,
    agentName:   row.agent_name,
    uploadedBy:  row.uploaded_by,
    isUsed:      row.is_used,
    isDuplicate: row.is_duplicate,
  };
}

// ── Singleton Supabase client (service role — bypasses RLS) ──────────────
let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  // Prefer service role key (bypasses RLS), fall back to anon
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
           ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env'
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });

  logger.info('Supabase client initialised (service role)');
  return _client;
}

// ── In-memory cache ───────────────────────────────────────────────────────
interface AccountCache {
  data:        DbAccount[];
  lastFetched: number;
}

let cache: AccountCache | null = null;

const DB_REFRESH_MS = (): number =>
  Number(process.env.DB_REFRESH_INTERVAL_MS ?? 60_000);

const TABLE_NAME = (): string =>
  process.env.ACCOUNTS_TABLE ?? 'bank_data';

const TARGET_SUBAGENT_ID = (): string | null =>
  process.env.TARGET_SUBAGENT_ID ?? null;

const MATCH_ALL = (): boolean =>
  (process.env.MATCH_ALL_RECORDS ?? 'false').toLowerCase() === 'true';

// ── Load accounts from bank_data ─────────────────────────────────────────
export async function loadAccounts(): Promise<DbAccount[]> {
  const now = Date.now();

  // Serve from cache if still fresh
  if (cache && now - cache.lastFetched < DB_REFRESH_MS()) {
    return cache.data;
  }

  try {
    const supabase = getSupabaseClient();
    const table    = TABLE_NAME();
    const matchAll = MATCH_ALL();
    const targetId = TARGET_SUBAGENT_ID();

    logger.debug({
      table,
      matchAll,
      targetSubagentId: targetId ?? 'ALL',
    }, 'Loading accounts from Supabase...');

    let query = supabase
      .from(table)
      .select(
        'id, bank_name, holder_name, account_number, ifsc_code, ' +
        'mobile_number, pincode, location, additional_name, ' +
        'uploaded_by, uploaded_by_name, agent_id, agent_name, ' +
        'subagent_id, subagent_name, referrer_id, referrer_name, ' +
        'is_used, is_duplicate, duplicate_of, uploaded_at, updated_at'
      );

    // ── Filter: only Sukh6565's records unless MATCH_ALL_RECORDS=true ────
    if (!matchAll && targetId) {
      // Match records where subagent_id = Sukh6565's UUID
      // OR uploaded_by = Sukh6565's UUID (catches both possible columns)
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
      .filter(r => r.account_number && r.ifsc_code)  // skip incomplete rows
      .map(mapRow);

    cache = { data: accounts, lastFetched: now };

    logger.info({
      count:           accounts.length,
      table,
      matchAll,
      targetSubagent:  matchAll ? 'ALL' : (targetId ?? 'ALL'),
    }, '✅ Accounts loaded from Supabase');

    return accounts;

  } catch (err) {
    if (cache) {
      logger.warn({ err }, 'Supabase refresh failed — using stale cache');
      return cache.data;
    }
    logger.error({ err }, 'Supabase initial load failed');
    throw err;
  }
}

// ── Force cache refresh ────────────────────────────────────────────────────
export function invalidateCache(): void {
  if (cache) {
    cache.lastFetched = 0;
  }
}
