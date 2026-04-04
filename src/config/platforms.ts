// ============================================================
// Platform Configuration — 10 Real Payment Platforms
// ============================================================
//
// ✅ tivry        → live credentials
// 🔑 All others  → fill in baseUrl + token from your dashboard
//
// Common API path for all platforms:
//   /xxapi/buyitoken/waitpayerpaymentslip
// Common header required:
//   indiatoken: <your-token>
// ============================================================

import type { PlatformConfig } from '../types/index.js';

export const platforms: PlatformConfig[] = [

  // ── 1. tivry ─────────────────────────────────────────────────
  // ✅ Live credentials — verified
  {
    id:             'tivry',
    baseUrl:        'https://r6w1t4doia.com/xxapi/buyitoken/waitpayerpaymentslip',
    token:          '08c3138296b747cb8924bd0ae5275687',
    headers: {
      origin:  'https://web.tivrapay.com/',
      referer: 'https://web.tivrapay.com/',
    },
    pollIntervalMs: 4000,
    maxPages:       5,
    pageSize:       50,
  },

  // ── 2. zippay ────────────────────────────────────────────────
  // 🔑 Replace baseUrl and token with real values
  {
    id:             'zippay',
    baseUrl:        'FILL_IN_ZIPPAY_BASEURL',   // e.g. https://api.zippay.in/xxapi/buyitoken/waitpayerpaymentslip
    token:          'FILL_IN_ZIPPAY_TOKEN',
    headers: {
      origin:  'https://web.zippay.in/',
      referer: 'https://web.zippay.in/',
    },
    pollIntervalMs: 4000,
    maxPages:       5,
    pageSize:       50,
  },

  // ── 3. uupay ─────────────────────────────────────────────────
  // 🔑 Replace baseUrl and token with real values
  {
    id:             'uupay',
    baseUrl:        'FILL_IN_UUPAY_BASEURL',    // e.g. https://api.uupay.in/xxapi/buyitoken/waitpayerpaymentslip
    token:          'FILL_IN_UUPAY_TOKEN',
    headers: {
      origin:  'https://web.uupay.in/',
      referer: 'https://web.uupay.in/',
    },
    pollIntervalMs: 4000,
    maxPages:       5,
    pageSize:       50,
  },

  // ── 4. milespay ──────────────────────────────────────────────
  // 🔑 Replace baseUrl and token with real values
  {
    id:             'milespay',
    baseUrl:        'FILL_IN_MILESPAY_BASEURL', // e.g. https://api.milespay.com/xxapi/buyitoken/waitpayerpaymentslip
    token:          'FILL_IN_MILESPAY_TOKEN',
    headers: {
      origin:  'https://web.milespay.com/',
      referer: 'https://web.milespay.com/',
    },
    pollIntervalMs: 4500,
    maxPages:       5,
    pageSize:       50,
  },

  // ── 5. supercoin ─────────────────────────────────────────────
  // 🔑 Replace baseUrl and token with real values
  {
    id:             'supercoin',
    baseUrl:        'FILL_IN_SUPERCOIN_BASEURL', // e.g. https://api.supercoin.io/xxapi/buyitoken/waitpayerpaymentslip
    token:          'FILL_IN_SUPERCOIN_TOKEN',
    headers: {
      origin:  'https://web.supercoin.io/',
      referer: 'https://web.supercoin.io/',
    },
    pollIntervalMs: 4000,
    maxPages:       5,
    pageSize:       50,
  },

  // ── 6. goldersizle ───────────────────────────────────────────
  // 🔑 Replace baseUrl and token with real values
  {
    id:             'goldersizle',
    baseUrl:        'FILL_IN_GOLDERSIZLE_BASEURL', // e.g. https://api.goldersizle.com/xxapi/buyitoken/waitpayerpaymentslip
    token:          'FILL_IN_GOLDERSIZLE_TOKEN',
    headers: {
      origin:  'https://web.goldersizle.com/',
      referer: 'https://web.goldersizle.com/',
    },
    pollIntervalMs: 4500,
    maxPages:       5,
    pageSize:       50,
  },

  // ── 7. linkpay ───────────────────────────────────────────────
  // 🔑 Replace baseUrl and token with real values
  {
    id:             'linkpay',
    baseUrl:        'FILL_IN_LINKPAY_BASEURL',   // e.g. https://api.linkpay.in/xxapi/buyitoken/waitpayerpaymentslip
    token:          'FILL_IN_LINKPAY_TOKEN',
    headers: {
      origin:  'https://web.linkpay.in/',
      referer: 'https://web.linkpay.in/',
    },
    pollIntervalMs: 4000,
    maxPages:       5,
    pageSize:       50,
  },

  // ── 8. gtod ──────────────────────────────────────────────────
  // 🔑 Replace baseUrl and token with real values
  {
    id:             'gtod',
    baseUrl:        'FILL_IN_GTOD_BASEURL',      // e.g. https://api.gtod.in/xxapi/buyitoken/waitpayerpaymentslip
    token:          'FILL_IN_GTOD_TOKEN',
    headers: {
      origin:  'https://web.gtod.in/',
      referer: 'https://web.gtod.in/',
    },
    pollIntervalMs: 5000,
    maxPages:       5,
    pageSize:       50,
  },

  // ── 9. gmpay ─────────────────────────────────────────────────
  // 🔑 Replace baseUrl and token with real values
  {
    id:             'gmpay',
    baseUrl:        'FILL_IN_GMPAY_BASEURL',     // e.g. https://api.gmpay.in/xxapi/buyitoken/waitpayerpaymentslip
    token:          'FILL_IN_GMPAY_TOKEN',
    headers: {
      origin:  'https://web.gmpay.in/',
      referer: 'https://web.gmpay.in/',
    },
    pollIntervalMs: 4000,
    maxPages:       5,
    pageSize:       50,
  },

  // ── 10. floxy ────────────────────────────────────────────────
  // 🔑 Replace baseUrl and token with real values
  {
    id:             'floxy',
    baseUrl:        'FILL_IN_FLOXY_BASEURL',     // e.g. https://api.floxy.co/xxapi/buyitoken/waitpayerpaymentslip
    token:          'FILL_IN_FLOXY_TOKEN',
    headers: {
      origin:  'https://web.floxy.co/',
      referer: 'https://web.floxy.co/',
    },
    pollIntervalMs: 4500,
    maxPages:       5,
    pageSize:       50,
  },

];

// ── Runtime validation — warn loudly about unfilled placeholders ──────────
const unfilled = platforms.filter(p =>
  p.baseUrl.startsWith('FILL_IN') || p.token.startsWith('FILL_IN')
);

if (unfilled.length > 0) {
  const ids = unfilled.map(p => p.id).join(', ');
  console.warn(
    `⚠️  [platforms.ts] ${unfilled.length} platform(s) have placeholder credentials and will be SKIPPED: ${ids}`
  );
}

// Export only platforms with real credentials filled in
export const activePlatforms: PlatformConfig[] = platforms.filter(
  p => !p.baseUrl.startsWith('FILL_IN') && !p.token.startsWith('FILL_IN')
);
