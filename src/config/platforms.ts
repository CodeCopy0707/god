import type { PlatformConfig } from '../types/index.js';

export const platforms: PlatformConfig[] = [
  {
    id: 'goldensizzle',
    baseUrl: 'https://api.goldensizzle.com/investment-products',
    token: process.env.GOLDENSIZZLE_TOKEN ?? '',
    useBearerAuth: true,
    apiStyle: 'modern',
    headers: {
      origin: 'https://ynwww.goldensizzle.com',
      referer: 'https://ynwww.goldensizzle.com/',
    },
    customHeaders: {
      'x-version': '1',
    },
    customParams: {
      type: 'all',
      sort_by: 'desc',
    },
    pollIntervalMs: 1000,
    maxPages: 20,
    pageSize: 50,
  },
  {
    id: 'gmpay',
    baseUrl: 'https://api.gmpay.wiki/xxapi/buyitoken/waitpayerpaymentslip',
    token: process.env.GMPAY_TOKEN ?? '',
    headers: {
      origin: 'https://web.gmpay.top',
      referer: 'https://web.gmpay.top/',
    },
    customParams: {
      method: '1',
      date_asc: '0',
    },
    pollIntervalMs: 1000,
    maxPages: 20,
    pageSize: 50,
  },
  {
    id: 'supercoin',
    baseUrl: 'https://rapi.supercoinpay.com/xxapi/buyitoken/waitpayerpaymentslip',
    token: process.env.SUPERCOIN_TOKEN ?? '',
    headers: {
      origin: 'https://refer.supercoinpay.com',
      referer: 'https://refer.supercoinpay.com/',
    },
    customParams: {
      method: '0',
      date_asc: '0',
    },
    pollIntervalMs: 1000,
    maxPages: 20,
    pageSize: 50,
  },
  {
    id: 'milespay',
    baseUrl: 'https://api.gronix.xyz/xxapi/buyitoken/waitpayerpaymentslip',
    token: process.env.MILESPAY_TOKEN ?? '',
    headers: {
      origin: 'https://milesm.skin',
      referer: 'https://milesm.skin/',
    },
    customParams: {
      method: '0',
      date_asc: '0',
    },
    pollIntervalMs: 1000,
    maxPages: 20,
    pageSize: 50,
  },
  {
    id: 'gtod',
    baseUrl: 'https://api.crelyn.xyz/xxapi/buyitoken/waitpayerpaymentslip',
    token: process.env.GTOD_TOKEN ?? '',
    headers: {
      origin: 'https://gtod.top',
      referer: 'https://gtod.top/',
    },
    customParams: {
      method: '1',
      date_asc: '0',
    },
    pollIntervalMs: 1000,
    maxPages: 20,
    pageSize: 50,
  },
  {
    id: 'tivrapay',
    baseUrl: 'https://r6w1t4doia.com/xxapi/buyitoken/waitpayerpaymentslip',
    token: process.env.TIVRAPAY_TOKEN ?? '',
    headers: {
      origin: 'https://web.tivrapay.com/',
      referer: 'https://web.tivrapay.com/',
    },
    customParams: {
      method: '1',
      date_asc: '1',
    },
    pollIntervalMs: 1000,
    maxPages: 20,
    pageSize: 50,
  },
  {
    id: 'zippay',
    baseUrl: 'https://api.kelura.xyz/xxapi/buyitoken/waitpayerpaymentslip',
    token: process.env.ZIPPAY_TOKEN ?? '',
    headers: {
      origin: 'https://web.zippay.wiki',
      referer: 'https://web.zippay.wiki/',
    },
    customParams: {
      method: '1',
      date_asc: '0',
    },
    pollIntervalMs: 1000,
    maxPages: 20,
    pageSize: 50,
  },
  {
    id: 'floxypay',
    baseUrl: 'https://api.plavix.skin/xxapi/buyitoken/waitpayerpaymentslip',
    token: process.env.FLOXYPAY_TOKEN ?? '',
    headers: {
      origin: 'https://web.floxypay.ink',
      referer: 'https://web.floxypay.ink/',
    },
    customParams: {
      method: '0',
      date_asc: '0',
    },
    pollIntervalMs: 1000,
    maxPages: 20,
    pageSize: 50,
  },
  {
    id: 'linkpay',
    baseUrl: 'https://api.linkpay.homes/xxapi/buyitoken/waitpayerpaymentslip',
    token: process.env.LINKPAY_TOKEN ?? '',
    headers: {
      origin: 'https://linkpays-in.com',
      referer: 'https://linkpays-in.com/',
    },
    customParams: {
      method: '0',
      date_asc: '0',
    },
    pollIntervalMs: 1000,
    maxPages: 20,
    pageSize: 50,
  },
];

// Runtime validation - warn about missing tokens
const missingTokens = platforms.filter(p => !p.token);

if (missingTokens.length > 0) {
  const ids = missingTokens.map(p => p.id).join(', ');
  console.warn(
    `âš ï¸ [platforms.ts] ${missingTokens.length} platform(s) are missing tokens in .env and will be SKIPPED: ${ids}`
  );
}

// Export only platforms with a token configured
export const activePlatforms: PlatformConfig[] = platforms.filter(p => !!p.token);
