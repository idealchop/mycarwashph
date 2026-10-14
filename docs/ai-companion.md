# AI Companion (chat only, same as Barbers.ph)

Oct 15, 2026: this replaces the earlier "AI Insights" design (insight cards, blurred tips, rule-based alerts) with the Barbers.ph approach: one chat thread per shop.

## What the owner sees
- `/companion`: one continuous chat per shop (owners only). Older messages load as the owner scrolls up. Reached from the Home button and Account > Features.
- Every message is a plain text bubble. Monday tips come as one message tagged "Monday tips". Pro/Lifetime alerts come as messages tagged "Heads up". There are no cards and no insights page.
- Hidden on prod: `COMPANION_ENABLED=1` (apphosting.dev.yaml) → `NEXT_PUBLIC_COMPANION_ENABLED`. When it is off, /companion redirects to /home.

## How (mirrors Barbers lib/server/companion)
- Gemini 2.5 Flash on Vertex AI (asia-southeast1), with function calling over read-only tools. `services/companion/tools.ts` loads the shop's raw docs (sales, queue, bookings, services, bays) once per question, and the tools count over them:
  - `getSales`: recorded payments, plus cars served and cars done-but-unpaid.
  - `getBookings`: walk-ins by every queue status (queued, in_bay, done, paid, closed, cancelled), cars in the queue now, and River Mobile bookings by status and source.
  - `topServices`, `staffPerformance` (per bay), `inactiveCustomers`, `goalProgress`.
  - `branchComparison` and `setGoal` are Pro/Lifetime only.
- Customer names and plates are returned only when the owner explicitly asks.
- Monday tips (`tips-service.ts`, same as Barbers `weeklyTips`): the tool numbers are sent as JSON and the model returns `{tips, alerts}`. The tips are posted as one plain `tip` message (Partner: first tip plus "N more tips are waiting for you on Pro or Lifetime"). Alerts are Pro/Lifetime only. `insights/{weekId}` keeps a record of the run (idempotent per week).

## Storage (`businesses/{id}/…`, server-only)
- `companion/threads/messages/{id}`: the thread.
- `companion/goals`.
- `companion/usage`: questions, tokens and cost per month and week, plus an `ai_usage` log line.
- `insights/{weekId}`: record of each Monday run.

## Tiers
- Partner: 10 questions a month and 1 Monday tip.
- Pro / Lifetime: unlimited questions, all tips, alerts, goals and branch comparison.

## API
- `GET /businesses/:id/companion`: newest page, goals and quota.
- `GET …/companion/messages?before=`: older messages.
- `POST …/companion/messages`: ask a question.
- `POST …/companion/weekly`: this week's tips for the owner's shop (`force` only on dev).

## Functions
| Function | Schedule | Notes |
| --- | --- | --- |
| mycarwashCompanionWeeklyDev / Prod | Mon 07:00 PH | Prod exits early unless `COMPANION_ENABLED=1` or `INSIGHTS_PROD_ENABLED=true` |

Removed Oct 15, 2026: `mycarwashCompanionAlertsDev/Prod` (rule-based daily alerts; Barbers has none).
