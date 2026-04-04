# Payment Order Matching & Alerting System

A production-ready, real-time payment order matching and Telegram alerting system
built with **Node.js 18+**, **TypeScript** (strict mode), **Supabase**, and **PM2**.

---

## Architecture

```
10 Payment Platforms
        │
        ▼
  Polling Engine (per-platform async loops, 4–5s interval)
        │
        ▼
  Order Filter + Normaliser
  (amount ≥ 5000 · deduplicate · normalise fields)
        │
        ▼
  Matching Engine ◄──── Supabase DB (accounts cached 60s)
  (last-4 acctNo + IFSC prefix 4-char match)
        │
        ▼
  Telegram Bot (rate-limited 1 msg/2s, retry once)
        │
        ▼
  Telegram Group (receives match alerts)
```

---

## Project Structure

```
src/
├── config/
│   └── platforms.ts       ← All 10 platform configs
├── fetcher/
│   └── fetchPlatform.ts   ← Multi-page API fetcher
├── matcher/
│   └── matchOrder.ts      ← IFSC prefix + last-4 matching
├── db/
│   └── supabase.ts        ← Supabase client + cached loader
├── bot/
│   └── telegramBot.ts     ← Alert sender with queue
├── orchestrator/
│   └── poller.ts          ← Per-platform polling loops
├── utils/
│   └── logger.ts          ← Pino logger
├── types/
│   └── index.ts           ← Shared TypeScript interfaces
└── index.ts               ← Entry point
```

---

## Prerequisites

- Node.js **18+**
- A [Supabase](https://supabase.com) project with an `accounts` table
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))
- PM2 installed globally: `npm install -g pm2`

### Supabase `accounts` Table Schema

```sql
CREATE TABLE accounts (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acctNo  TEXT NOT NULL,   -- full bank account number
  ifsc    TEXT NOT NULL,   -- full IFSC code (e.g. SBIN0001234)
  name    TEXT
);

-- Index for faster matching
CREATE INDEX ON accounts (acctNo);
CREATE INDEX ON accounts (ifsc);
```

---

## Setup

### 1. Clone and install dependencies

```bash
git clone <your-repo>
cd payment-matcher
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_GROUP_ID` | Target group ID (negative number for supergroups) |
| `ACCOUNTS_TABLE` | Supabase table name (default: `accounts`) |
| `MIN_AMOUNT` | Minimum order amount to process (default: `5000`) |
| `SEEN_RESET_INTERVAL_MS` | How often to clear seen-orders cache (default: `300000`) |
| `DB_REFRESH_INTERVAL_MS` | How often to refresh accounts from DB (default: `60000`) |
| `LOG_LEVEL` | Logging verbosity: `debug` / `info` / `warn` (default: `info`) |

> **How to get your Telegram Group ID:**  
> Add [@userinfobot](https://t.me/userinfobot) to your group — it will reply with the group ID.

### 3. Add your platform tokens

Edit `src/config/platforms.ts` and update the `token` values for each platform. Platforms 3–10 have placeholder tokens — replace them with real credentials.

---

## Running

### Development (with ts-node, hot-reload friendly)

```bash
npm run dev
```

### Production (build then run)

```bash
npm run build
npm start
```

### Production with PM2 (recommended)

```bash
npm run build
npm run pm2
```

Or directly:

```bash
pm2 start ecosystem.config.cjs --env production
```

**PM2 commands:**

```bash
pm2 status                    # check process status
pm2 logs payment-matcher      # tail live logs
pm2 stop payment-matcher      # stop the process
pm2 restart payment-matcher   # restart
pm2 delete payment-matcher    # remove from PM2
pm2 startup                   # enable auto-start on reboot
pm2 save                      # save current PM2 process list
```

---

## Matching Logic

Two conditions **both** must pass for a match:

1. **Last 4 digits** of `order.acctNo` === last 4 digits of `db.acctNo`
2. **First 4 chars** of `order.acctCode` (IFSC) === first 4 chars of `db.ifsc`

This means any branch of the same bank will match:
- `SBIN0001234` and `SBIN0099999` → both match prefix `SBIN`
- `PUNB0123456` and `PUNB0999999` → both match prefix `PUNB`

---

## Alert Format

When a match is found, this message is sent to the Telegram group:

```
🔔 MATCH FOUND
🏦 Platform: tivrapay
💳 Account: XXXXXXXXXX1234
🏛 IFSC: SBIN0001234
👤 Name: John Doe
💰 Amount: ₹10000.00
💸 Real Amount: ₹9950.00
🎁 Reward: 50
🧾 Order No: ORD20240101001
📌 Status: 1
⏱ Time: 1/1/2024, 10:30:00 AM
👤 User ID: USR123
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Platform API error | Log + return `[]`, next poll continues |
| JSON parse failure | Log + stop pagination for that page |
| Supabase refresh fails | Log + use last cached data |
| Supabase initial load fails | Log + `process.exit(1)` (fail fast) |
| Order match throws | Log + skip that order |
| Telegram send fails | Log + retry once after 3s |
| One platform crashes | Other 9 platforms continue unaffected |

---

## Environment Security

- Never commit your `.env` file — it is listed in `.gitignore`
- Use Supabase Row Level Security (RLS) for the `accounts` table in production
- Rotate your Telegram bot token if exposed

---

## Logs

Logs are written to:
- **Console** — structured JSON (or pretty in dev)
- **`logs/out.log`** — stdout (PM2)
- **`logs/err.log`** — stderr (PM2)

Set `LOG_LEVEL=debug` to see per-order and per-page debug information.
