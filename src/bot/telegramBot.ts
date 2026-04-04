// ============================================================
// Telegram Bot — Rate-limited alert sender with retry queue
// ============================================================

import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger.js';
import type { Order } from '../types/index.js';

// ── Bot singleton ─────────────────────────────────────────────────────────
let _bot: TelegramBot | null = null;

export function getBot(): TelegramBot {
  if (_bot) return _bot;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN must be set in .env');
  }

  _bot = new TelegramBot(token, { polling: false });
  logger.info('Telegram bot initialised');
  return _bot;
}

// ── Message queue with 1-message-per-2s rate limit ───────────────────────
interface QueueItem {
  chatId:  string;
  message: string;
  attempt: number;
}

const queue:        QueueItem[] = [];
let   isProcessing: boolean     = false;

const RATE_LIMIT_MS = 2_000;  // max 1 message per 2 s
const RETRY_DELAY   = 3_000;  // retry after 3 s on failure

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const item = queue.shift()!;
    try {
      await getBot().sendMessage(item.chatId, item.message, {
        parse_mode: 'HTML',
      });
      logger.debug({ chatId: item.chatId }, 'Telegram message sent');
    } catch (err) {
      logger.error({ err, attempt: item.attempt }, 'Telegram send failed');

      if (item.attempt < 2) {
        // Retry once after 3 s
        setTimeout(() => {
          queue.unshift({ ...item, attempt: item.attempt + 1 });
          void processQueue();
        }, RETRY_DELAY);
      } else {
        logger.warn({ chatId: item.chatId }, 'Telegram message dropped after retry');
      }
    }

    if (queue.length > 0) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  isProcessing = false;
}

// ── Format unix timestamp → readable date ─────────────────────────────────
function formatDate(ts: number): string {
  // Handle both seconds and milliseconds
  const ms  = ts > 1e10 ? ts : ts * 1000;
  return new Date(ms).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

// ── Build alert message ───────────────────────────────────────────────────
function buildMessage(order: Order): string {
  const amount     = order.amount.toFixed(2);
  const realAmount = order.realAmount !== undefined
    ? order.realAmount.toFixed(2) : 'N/A';
  const reward  = order.reward !== undefined ? String(order.reward) : 'N/A';
  const userId  = order.userId ?? 'N/A';
  const time    = formatDate(order.crtDate);

  return [
    `🔔 <b>MATCH FOUND</b>`,
    `🏦 <b>Platform:</b> ${order.platform}`,
    `💳 <b>Account:</b> ${order.acctNo}`,
    `🏛 <b>IFSC:</b> ${order.acctCode}`,
    `👤 <b>Name:</b> ${order.acctName}`,
    `💰 <b>Amount:</b> ₹${amount}`,
    `💸 <b>Real Amount:</b> ₹${realAmount}`,
    `🎁 <b>Reward:</b> ${reward}`,
    `🧾 <b>Order No:</b> ${order.orderNo}`,
    `📌 <b>Status:</b> ${order.orderState}`,
    `⏱ <b>Time:</b> ${time}`,
    `👤 <b>User ID:</b> ${userId}`,
  ].join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────
export async function sendTelegramAlert(order: Order): Promise<void> {
  const groupId = process.env.TELEGRAM_GROUP_ID;
  if (!groupId) {
    logger.error('TELEGRAM_GROUP_ID not set — cannot send alert');
    return;
  }

  const message = buildMessage(order);

  queue.push({ chatId: groupId, message, attempt: 1 });
  logger.info({ platform: order.platform, orderNo: order.orderNo },
    'Match queued for Telegram alert');

  void processQueue();
}
