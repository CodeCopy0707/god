// ============================================================
// Archived Platform Configurations
// ============================================================
// These platforms were removed from active polling to reduce
// load and isolate fetches to a single platform for testing.

import type { PlatformConfig } from '../types/index.js';

export const archivedPlatforms: PlatformConfig[] = [

  // ── 2. zippay ────────────────────────────────────────────────
  // 🔑 Replace token with real value
  {
    id: 'zippay',
    baseUrl: 'https://api.kelura.xyz/xxapi/buyitoken/waitpayerpaymentslip',
    token: 'cf61e0ef19894d6e9567c8fa21508d07',
    headers: {
      origin: 'https://web.zippay.wiki',
      referer: 'https://web.zippay.wiki',
    },
    pollIntervalMs: 2000,
    maxPages: 20,
    pageSize: 50,
  },

  // ── 3. crelyn ────────────────────────────────────────────────
  // 🔑 Replace token with real value
  {
    id: 'gtod',
    baseUrl: 'https://api.crelyn.xyz/xxapi/buyitoken/waitpayerpaymentslip',
    token: '02a2e360481a419fb5383b41947f1f1f',
    headers: {
      origin: 'https://api.crelyn.xyz',
      referer: 'https://api.crelyn.xyz/',
    },
    pollIntervalMs: 2000,
    maxPages: 20,
    pageSize: 50,
  },

  // ── 4. gronix ──────────────────────────────────────────────
  // 🔑 Replace token with real value
  {
    id: 'milespay',
    baseUrl: 'https://api.gronix.xyz/xxapi/buyitoken/waitpayerpaymentslip',
    token: '037c65a1542c4d1f9737473248f3918e',
    headers: {
      origin: 'https://milesm.skin',
      referer: 'https://milesm.skin/',
    },
    pollIntervalMs: 2000,
    maxPages: 20,
    pageSize: 50,
  },

  // ── 5. supercoin ─────────────────────────────────────────────
  // 🔑 Replace token with real value
  {
    id: 'supercoin',
    baseUrl: 'https://rapi.supercoinpay.com/xxapi/buyitoken/waitpayerpaymentslip',
    token: '2607636946d74f5094d80b3c6c2b493c',
    customParams: {
      if_asc: 'true',
      min_amount: '100',
      max_amount: '100000',
      date_asc: '0',
    },
    pollIntervalMs: 3000,
    maxPages: 20,
    pageSize: 50,
  },

  // ── 6. goldensizzle ──────────────────────────────────────────
  // 🔑 Replace token with real value
  {
    id: 'goldensizzle',
    baseUrl: 'https://api.goldensizzle.com/investment-products',
    token: '194795|8opGZyoVc5AkvgdmcSwnGWDZOm3iw7kp3zIaEu1r',
    useBearerAuth: true,
    apiStyle: 'modern',
    customParams: {
      type: 'all',
    },
    headers: {
      origin: 'https://ynwww.goldensizzle.com',
      referer: 'https://ynwww.goldensizzle.com/',
    },
    pollIntervalMs: 3000,
    maxPages: 20,
    pageSize: 50,
  },

  // ── 7. linkpay ───────────────────────────────────────────────
  // 🔑 Replace token with real value
  {
    id: 'linkpay',
    baseUrl: 'https://api.linkpay.homes/xxapi/buyitoken/waitpayerpaymentslip',
    token: '24b9c170f2aa4d26a99733c605c14ad3',
    headers: {
      origin: 'https://api.linkpay.homes',
      referer: 'https://api.linkpay.homes/',
    },
    pollIntervalMs: 2000,
    maxPages: 20,
    pageSize: 50,
  },

  // ── 8. plavix ────────────────────────────────────────────────
  // 🔑 Replace token with real value
  {
    id: 'floxy',
    baseUrl: 'https://api.plavix.skin/xxapi/buyitoken/waitpayerpaymentslip',
    token: '979727260fab47598a9f3cb1fb9acaa9',
    headers: {
      origin: 'https://web.plavix.skin',
      referer: 'https://web.plavix.skin/',
    },
    customParams: {
      max_amount: '100000',
      date_asc: '0',
    },
    pollIntervalMs: 3000,
    maxPages: 20,
    pageSize: 50,
  },

  // ── 9. gmpay ─────────────────────────────────────────────────
  // 🔑 Replace token with real value
  {
    id: 'gmpay',
    baseUrl: 'https://api.gmpay.wiki/xxapi/buyitoken/waitpayerpaymentslip',
    token: '57f5470f53554be39e87c2d8f0f1c0a4',
    headers: {
      origin: 'https://web.gmpay.wiki',
      referer: 'https://web.gmpay.wiki/',
    },
    pollIntervalMs: 2000,
    maxPages: 20,
    pageSize: 50,
  },

  // ── 10. floxy_legacy ────────────────────────────────────────
  // 🔑 Replace baseUrl and token with real values
  {
    id: 'floxy_legacy',
    baseUrl: 'https://api.floxy.co/xxapi/buyitoken/waitpayerpaymentslip',     // e.g. https://api.floxy.co/xxapi/buyitoken/waitpayerpaymentslip
    token: 'a3656ac080474b34a35ee3f38d60d4cc',
    headers: {
      origin: 'https://web.floxy.co/',
      referer: 'https://web.floxy.co/',
    },
    pollIntervalMs: 2000,
    maxPages: 20,
    pageSize: 50,
  },

];
