# Remaining Steps

## What Is Already Implemented
- Multi-platform config restored from `headers-payload-responses.md` in `src/config/platforms.ts`.
- Fast matcher and polling pipeline are active.
- Realtime dashboard backend added:
  - `src/dashboard/server.ts`
  - `src/dashboard/store.ts`
  - `src/dashboard/template.ts`
- Runtime order event persistence layer added:
  - `src/db/runtimeEvents.ts`
- Poller now publishes observed/matched events to dashboard store.
- Main app starts dashboard server from `src/index.ts`.
- Env template updated with dashboard and runtime storage vars in `.env.example`.
- Supabase schema SQL added in `supabase/matcher_dashboard_schema.sql`.

## Remaining Manual Steps
1. Add your real env values in `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_GROUP_ID`
   - `TARGET_SUBAGENT_ID` (or `MATCH_ALL_RECORDS=true`)
   - `DASHBOARD_ADMIN_ID`
   - `DASHBOARD_ADMIN_PASSWORD`
   - `DASHBOARD_SESSION_SECRET`

2. Create runtime events table in Supabase SQL editor by running:
   - `supabase/matcher_dashboard_schema.sql`

3. Start service and verify:
   - App boot logs should show pollers + dashboard server started.
   - Open `http://localhost:<DASHBOARD_PORT>/panel/login`.
   - Login with dashboard admin credentials.
   - Check live cards, platform table, recent orders, and recent matches.

## High-Volume Tuning (for 1L+ orders scan)
- `PLATFORM_MAX_PAGES_OVERRIDE`: set based on platform page size.
  - Example: if page size is 50 and target scan is 100000 orders, set to around `2000`.
- `FETCH_PAGE_BATCH_SIZE`: raise carefully based on CPU/network capacity.
- `MIN_AMOUNT`: keep as per filter requirement.

## Security Cleanup Still Recommended
- Move platform tokens and any hardcoded credentials to environment variables.
- Rotate exposed keys/tokens already committed previously.

## Verification Note
- Build/typecheck commands were attempted, but terminal session returned `aborted` for both runs.
- Re-run locally:
  - `npm run typecheck`
  - `npm run build`
