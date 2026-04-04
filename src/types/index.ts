// ============================================================
// Shared Interfaces — Payment Order Matching System
// ============================================================

export interface PlatformConfig {
  id: string;                          // unique name e.g. "tivrapay"
  baseUrl: string;                     // API endpoint
  token: string;                       // indiatoken header value
  headers?: Record<string, string>;    // any extra headers
  pollIntervalMs: number;              // polling interval in ms
  maxPages: number;                    // max pages to fetch per poll
  pageSize: number;                    // results per page
}

export interface Order {
  platform: string;
  orderNo: string;
  rptNo?: string;
  acctNo: string;      // bank account number
  acctCode: string;    // IFSC code
  acctName: string;
  amount: number;
  realAmount?: number;
  reward?: number;
  orderState: number;
  crtDate: number;     // unix timestamp
  userId?: string;
}

export interface DbAccount {
  id: string;
  acctNo: string;   // full account number stored in DB
  ifsc: string;     // full IFSC stored in DB (match only first 4 chars)
  name?: string;
  [key: string]: unknown;
}

export interface RawOrderResponse {
  code?: number;
  data?: {
    list?: RawOrder[];
    records?: RawOrder[];
    rows?: RawOrder[];
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
}
