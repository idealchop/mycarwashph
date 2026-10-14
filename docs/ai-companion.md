# AI Companion (owner chat + weekly tips)

Approved by Jimboy, Oct 14, 2026 (spec v2, replaces "AI Insights").

## What
- `/companion` chat page (owners only), reached from the Home card (latest tip) and Account > Features. Nav stays Home, Queue, Moments.
- River: friendly English/Taglish persona + PH car wash consultant (pricing, promos, staffing, operations, retention, compliance, marketing).
- Monday 07:00 Asia/Manila tips (3-5) saved to `businesses/{id}/insights/{weekId}` and posted as a chat message.
- Alerts (deterministic, no model cost): last 7 days vs 28-day baseline (revenue drop/jump, queue wait spike, no-show spike), posted as chat messages, once per type per week. Daily 20:00 sweep + after the Monday job.
- Goals (e.g. ₱50,000 / month) with progress, projection and needed daily pace.

## How
- Gemini 2.5 Flash on Vertex AI (`@google/genai`, `vertexai: true`), region `asia-southeast1`, default service account, thinking budget 0.
- Chat uses function calling over READ-ONLY tools bound server-side to the owner's shop: getSales, getBookings, topServices, serviceMix, staffPerformance (per bay), carsPerHour, queuePeaks, branchComparison, inactiveCustomers, goalProgress, plus setGoal (writes only `companion/goals`).
- Customer PII (names/plates) is returned only with `includeDetails=true`, which the prompt allows only when the owner explicitly asks. Weekly tips send aggregates only.
- Storage: `businesses/{id}/companion/threads/messages/{id}`, `companion/goals`, `companion/usage` (per-month/week questions, tokens, cost). Firestore rules deny all client access; everything goes through the API.
- Cost: structured `ai_usage` log line per call (businessId, tokens, costUsd, week/month running totals) + `costUsd` on each message/insight. Pricing constants in `services/companion/model.ts`.

## Tiers (server-enforced)
- Partner: 10 questions / month (transactional quota), 1 tip of the weekly set (others stripped server-side, blurred in UI), no alerts, no goals.
- Pro / Lifetime (`plan: "paid"`): unlimited chat, all tips, alerts, goals; `/me/companion/combined` for multi-shop owners; `branchComparison` tool.

## Functions
| Function | Schedule | Notes |
| --- | --- | --- |
| mycarwashCompanionWeeklyDev / Prod | Mon 07:00 PH | Prod exits early unless `INSIGHTS_PROD_ENABLED=true` |
| mycarwashCompanionAlertsDev / Prod | daily 20:00 PH | same guard |
Chat: `POST /businesses/:id/companion/messages` on mycarwashApi{Dev,Prod} (prod returns 503 while guarded).

Enable prod: set `INSIGHTS_PROD_ENABLED=true` in `backend/functions/.env.mycarwashph`, redeploy functions.

## Dev tools
`/companion` shows "Dev tools" on the dev backend only: seed ~30 days of demo data (as Pro or Partner) and run the Monday job for that shop. The API routes return 404/403 outside dev.

## Follow-ups
- Push/email delivery of tips and alerts (no provider yet).
- Per-staff performance (cars are tracked per bay, not per washer).
- Streaming replies; multiple threads.
