// ============================================================
// Shared Interfaces - Payment Order Matching System
// ============================================================

export interface PlatformConfig {
  id: string;
  baseUrl: string;
  token: string;
  headers?: Record<string, string>;
  pollIntervalMs: number;
  maxPages: number;
  pageSize: number;
  useBearerAuth?: boolean;
  apiStyle?: 'default' | 'modern';
  customHeaders?: Record<string, string>;
  customParams?: Record<string, string>;
  requestTimeoutMs?: number;
  freshnessLookbackSeconds?: number;
  stalePageThreshold?: number;
  failureBackoffMs?: number;
}

export interface Order {
  platform: string;
  orderNo: string;
  rptNo?: string;
  acctNo: string;
  acctCode: string;
  acctName: string;
  amount: number;
  realAmount?: number;
  reward?: number;
  orderState: number;
  crtDate: number;
  userId?: string;
}

export interface DbAccount {
  id: string;
  acctNo: string;
  ifsc: string;
  name?: string;
  bankName?: string | null;
  mobileNumber?: string | null;
  location?: string | null;
  subagentId?: string | null;
  subagentName?: string | null;
  agentId?: string | null;
  agentName?: string | null;
  uploadedBy?: string | null;
  isUsed?: boolean;
  isDuplicate?: boolean;
  [key: string]: unknown;
}

export type MatchKey = string;
export type DbAccountMatchIndex = Map<MatchKey, DbAccount[]>;

export interface AccountSnapshot {
  accounts: DbAccount[];
  matchIndex: DbAccountMatchIndex;
  fetchedAt: number;
}

export interface PlatformStatusSnapshot {
  platformId: string;
  lastPoll: string | null;
  lastRunSuccess: boolean;
  lastResultsCount: number;
  totalMatchesFound: number;
  inFlight: boolean;
  lastCycleStartedAt: string | null;
  lastCycleDurationMs: number;
  lastScanPages: number;
  consecutiveFailures: number;
  lastError: string | null;
  lastFreshOrderAt: string | null;
}

export interface ObservedOrderEvent {
  eventKey: string;
  platform: string;
  orderNo: string;
  rptNo?: string;
  acctNo: string;
  acctCode: string;
  acctName: string;
  amount: number;
  realAmount?: number;
  reward?: number;
  orderState: number;
  crtDate: number;
  userId?: string;
  receivedAt: string;
  matched: boolean;
  matchedAt?: string;
  matchedAccountId?: string;
  matchedAccountNo?: string;
  matchedIfsc?: string;
  matchedHolderName?: string;
  matchedBankName?: string;
  matchedSubagentId?: string;
  matchedSubagentName?: string;
}

export interface DashboardSnapshot {
  generatedAt: string;
  targetSubagentId: string | null;
  accountCount: number;
  matchBucketCount: number;
  totalObservedOrders: number;
  totalMatchedOrders: number;
  recentOrders: ObservedOrderEvent[];
  recentMatches: ObservedOrderEvent[];
  platforms: PlatformStatusSnapshot[];
  storage: {
    enabled: boolean;
    mode: 'supabase' | 'runtime';
    table: string;
    state: string;
  };
}

export interface RawOrderResponse {
  code?: number;
  data?: {
    list?: RawOrder[];
    records?: RawOrder[];
    rows?: RawOrder[];
    products?: RawOrder[];
    total?: number;
  };
  list?: RawOrder[];
  records?: RawOrder[];
}

export interface RawOrder {
  orderNo?: string;
  order_no?: string;
  rptNo?: string;
  rpt_no?: string;
  acctNo?: string;
  acct_no?: string;
  acctCode?: string;
  acct_code?: string;
  acctName?: string;
  acct_name?: string;
  amount?: string | number;
  realAmount?: string | number;
  real_amount?: string | number;
  reward?: string | number;
  orderState?: number | string;
  order_state?: number | string;
  crtDate?: number | string;
  crt_date?: number | string;
  userId?: string;
  user_id?: string;
  upi_account?: string;
  upi?: string;
  ifsc?: string;
  name?: string;
  account_name?: string;
  status?: string | number;
  created_at?: string | number;
}
