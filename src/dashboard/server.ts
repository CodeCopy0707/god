import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getRuntimeEventStorageInfo } from '../db/runtimeEvents.js';
import { loadAccountSnapshot } from '../db/supabase.js';
import { getPlatformStatusSnapshot } from '../orchestrator/poller.js';
import { logger } from '../utils/logger.js';
import type { DashboardSnapshot } from '../types/index.js';
import {
  getDashboardCounters,
  getMatchFeed,
  getOrderFeed,
  subscribeDashboardRefresh,
} from './store.js';
import { renderDashboardPage, renderLoginPage } from './template.js';

const SESSION_COOKIE_NAME = 'matcher_admin_session';
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 12;

function getDashboardPort(): number {
  const parsed = Number(process.env.DASHBOARD_PORT ?? 3010);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3010;
}

function getAdminId(): string {
  const adminId = process.env.DASHBOARD_ADMIN_ID;
  if (!adminId) {
    throw new Error('DASHBOARD_ADMIN_ID must be set in .env');
  }
  return adminId;
}

function getAdminPassword(): string {
  const password = process.env.DASHBOARD_ADMIN_PASSWORD;
  if (!password) {
    throw new Error('DASHBOARD_ADMIN_PASSWORD must be set in .env');
  }
  return password;
}

function getSessionSecret(): string {
  return process.env.DASHBOARD_SESSION_SECRET
    ?? process.env.TELEGRAM_BOT_TOKEN
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? 'matcher-dashboard-secret';
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function createSessionToken(adminId: string): string {
  const issuedAt = Date.now().toString();
  const payload = `${adminId}.${issuedAt}`;
  const signature = createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('hex');

  return Buffer.from(`${payload}.${signature}`, 'utf8').toString('base64url');
}

function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;

  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return false;

    const [adminId, issuedAt, signature] = parts;
    if (!adminId || !issuedAt || !signature) return false;
    if (!safeEqual(adminId, getAdminId())) return false;

    const issuedAtNumber = Number(issuedAt);
    if (!Number.isFinite(issuedAtNumber)) return false;
    if (Date.now() - issuedAtNumber > COOKIE_MAX_AGE_MS) return false;

    const expectedSignature = createHmac('sha256', getSessionSecret())
      .update(`${adminId}.${issuedAt}`)
      .digest('hex');

    return safeEqual(signature, expectedSignature);
  } catch {
    return false;
  }
}

function isAuthenticated(req: Request): boolean {
  return isValidSessionToken(req.cookies?.[SESSION_COOKIE_NAME]);
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isAuthenticated(req)) {
    next();
    return;
  }

  if (req.path.startsWith('/api/')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.redirect('/panel/login');
}

async function buildDashboardSnapshot(): Promise<DashboardSnapshot> {
  const accountSnapshot = await loadAccountSnapshot();
  const [recentOrders, recentMatches] = await Promise.all([
    getOrderFeed(100),
    getMatchFeed(100),
  ]);
  const counters = getDashboardCounters();

  return {
    generatedAt: new Date().toISOString(),
    targetSubagentId: process.env.MATCH_ALL_RECORDS === 'true'
      ? null
      : (process.env.TARGET_SUBAGENT_ID ?? null),
    accountCount: accountSnapshot.accounts.length,
    matchBucketCount: accountSnapshot.matchIndex.size,
    totalObservedOrders: counters.totalObservedOrders,
    totalMatchedOrders: counters.totalMatchedOrders,
    recentOrders,
    recentMatches,
    platforms: getPlatformStatusSnapshot(),
    storage: getRuntimeEventStorageInfo(),
  };
}

export function startDashboardServer(): {
  port: number;
  stop: () => Promise<void>;
} {
  const port = getDashboardPort();
  const app = express();

  app.disable('x-powered-by');
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (req, res) => {
    res.redirect(isAuthenticated(req) ? '/panel/dashboard' : '/panel/login');
  });

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'payment-matcher-dashboard' });
  });

  app.get('/panel/login', (req, res) => {
    if (isAuthenticated(req)) {
      res.redirect('/panel/dashboard');
      return;
    }

    res.type('html').send(renderLoginPage());
  });

  app.post('/panel/login', (req, res) => {
    const adminId = String(req.body.adminId ?? '');
    const password = String(req.body.password ?? '');

    if (!safeEqual(adminId, getAdminId()) || !safeEqual(password, getAdminPassword())) {
      res.status(401).type('html').send(renderLoginPage('Invalid admin credentials'));
      return;
    }

    res.cookie(SESSION_COOKIE_NAME, createSessionToken(adminId), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE_MS,
    });
    res.redirect('/panel/dashboard');
  });

  app.post('/panel/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME);
    res.redirect('/panel/login');
  });

  app.use('/panel', requireAuth);

  app.get('/panel/dashboard', (_req, res) => {
    res.type('html').send(renderDashboardPage(getAdminId()));
  });

  app.get('/panel/api/dashboard', async (_req, res) => {
    try {
      res.json(await buildDashboardSnapshot());
    } catch (err) {
      logger.error({ err }, 'Failed to build dashboard snapshot');
      res.status(500).json({ error: 'Failed to build dashboard snapshot' });
    }
  });

  app.get('/panel/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);

    const unsubscribe = subscribeDashboardRefresh((payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  });

  const server = app.listen(port, () => {
    logger.info({ port }, 'Admin dashboard server started');
  });

  return {
    port,
    stop: () => new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    }),
  };
}
