// ============================================================
// Supabase Client + Cached Account Loader
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import type { DbAccount } from '../types/index.js';

// ── Singleton Supabase client ─────────────────────────────────────────────
let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });

  logger.info('Supabase client initialised');
  return _client;
}

// ── In-memory account cache ───────────────────────────────────────────────
interface AccountCache {
  data:        DbAccount[];
  lastFetched: number;
}

let cache: AccountCache | null = null;

const DB_REFRESH_MS = () =>
  Number(process.env.DB_REFRESH_INTERVAL_MS ?? 60_000);

const TABLE_NAME = () =>
  process.env.ACCOUNTS_TABLE ?? 'accounts';

// ── Load all accounts (with 60 s refresh cache) ───────────────────────────
export async function loadAccounts(): Promise<DbAccount[]> {
  const now = Date.now();

  // Serve from cache if still fresh
  if (cache && now - cache.lastFetched < DB_REFRESH_MS()) {
    return cache.data;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME())
      .select('*');

    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }

    const accounts = (data ?? []) as DbAccount[];
    cache = { data: accounts, lastFetched: now };
    logger.info({ count: accounts.length, table: TABLE_NAME() },
      'Accounts loaded from Supabase');
    return accounts;

  } catch (err) {
    if (cache) {
      logger.warn({ err }, 'Supabase refresh failed — using stale cache');
      return cache.data;
    }
    // First load failure — propagate so the process can fail fast
    logger.error({ err }, 'Supabase initial load failed — cannot continue');
    throw err;
  }
}

// ── Force a cache refresh (called on a schedule from poller) ──────────────
export function invalidateCache(): void {
  if (cache) {
    cache.lastFetched = 0; // force next call to re-fetch
  }
}
