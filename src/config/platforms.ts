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
    id: 'tivry',
    baseUrl: 'https://r6w1t4doia.com/xxapi/buyitoken/waitpayerpaymentslip',
    token: '9acb37fab8a94d2d82e330cfbaef1907',
    headers: {
      origin: 'https://web.tivrapay.com/',
      referer: 'https://web.tivrapay.com/',
    },
    pollIntervalMs: 2000,
    maxPages: 20,
    pageSize: 50,
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
