import type { PlatformConfig } from '../types/index.js';

export const platforms: PlatformConfig[] = [
  {
    id: 'goldensizzle',
    baseUrl: 'https://api.goldensizzle.com/investment-products',
    token: '222205|hqscMqpquD0YBcRcGEv5cF5osTulluRW0y4P0TAm',
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
    token: '57f5470f53554be39e87c2d8f0f1c0a4',
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
    token: 'f49e2f3d2bf84ff993dfeefa4a80707a',
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
    token: '037c65a1542c4d1f9737473248f3918e',
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
    token: '02a2e360481a419fb5383b41947f1f1f',
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
    token: '9acb37fab8a94d2d82e330cfbaef1907',
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
    token: 'cf61e0ef19894d6e9567c8fa21508d07',
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
    token: 'a3656ac080474b34a35ee3f38d60d4cc',
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
    token: '24b9c170f2aa4d26a99733c605c14ad3',
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

export const activePlatforms: PlatformConfig[] = platforms;
