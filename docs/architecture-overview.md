# Architecture overview

**Shape A (monorepo FE + API).** One pnpm workspace:

| Path | What |
| :--- | :--- |
| `frontend/` | Next.js 16 app (App Router) on Firebase App Hosting. UI and reads via the API. |
| `backend/functions/` | Express apps on Cloud Functions v2 (Node 22, `asia-southeast1`), codebase `mycarwash`. All writes. |
| `packages/` | `@river-apps/ui`, `@river-apps/icons`, `@river-apps/tokens` (shared UI kit, no Firebase code). |
| `firestore.rules`, `storage.rules`, `firebase.json` | Rules and deploy config (repo root). |

## FE / BE contract

- The browser **never writes Firestore** and has **no Firestore SDK** at all. It uses Firebase Auth
  (sign-in/out, ID tokens) and calls the API. See [hybrid-read-model.md](./hybrid-read-model.md).
- Every mutation goes through the shop API, which uses the Admin SDK, checks membership and role,
  writes an audit log (`businesses/{id}/audit_logs`) and returns problem+json errors.
- Every mutation domain has a matching GET (dual-endpoint rule).
- Photo uploads also go through the API (`POST /businesses/:id/photos`, `/moment-photos`); Storage rules
  cannot check membership in named Firestore databases.

## Request path

```
browser ──/api/*──▶ App Hosting (Next.js route frontend/app/api/[...path]/route.ts)
                     adds X-Serverless-Authorization (App Hosting SA ID token), keeps the user's
                     Authorization: Bearer <Firebase ID token>
                   ──▶ private Cloud Run function mycarwashApi{Dev,Prod} (Express, backend/functions/src/app.ts)
River Mobile ──/v1/*──▶ App Hosting (frontend/app/v1/[...path]/route.ts) ──▶ mycarwashPublicApi{Dev,Prod}
```

The functions are private (org policy forbids `allUsers`); only the App Hosting service account
may invoke them. The upstream URL comes from `API_UPSTREAM_URL` / `PUBLIC_API_UPSTREAM_URL`
(`apphosting.<env>.yaml`), see [environments.md](./environments.md).

## Backend layout (`backend/functions/src`)

| Folder | Role |
| :--- | :--- |
| `index.ts` | Function exports: `mycarwashApi{Dev,Prod}`, `mycarwashPublicApi{Dev,Prod}`, `mycarwashCompanionWeekly{Dev,Prod}` (Monday 07:00 PHT scheduler) |
| `app.ts` | `createApp` (shop API) and `createPublicApp` (`/v1`) |
| `routes/` | `me-routes` (`/me`, `/businesses`, invites), `business-routes` (`/businesses/:businessId/...`), `companion-routes`, `moments-routes`, `v1/public-routes` |
| `middleware/` | `requireAuth` (Firebase ID token), `requireMembership` / `requirePlan` / `requireRole` (tenant wall), `requireApiClient` + `requireScope` (`/v1` keys), validation, errors, CORS, rate limit |
| `services/` | Domain logic (queue, bookings, sales, catalog, billing, starter services, moments, companion/…) |
| `store/` | `DocStore` interface with Firestore and in-memory implementations (tests use memory) |
| `config/` | `brand.ts`, `environments.ts` (dev/prod matrix), `env.ts`, `plan-gating.ts` |

## Frontend layout (`frontend/`)

| Folder | Role |
| :--- | :--- |
| `app/` | Routes. `(shop)/` is the signed-in shop app (home, queue, scan, sales, history, settings, companion, moments). `api/` and `v1/` are the proxies. |
| `features/` | Screens by domain (`home`, `queue`, `orders`, `account`, `companion`, `moments`, `sales`) |
| `components/` | Shared shop UI (shell, auth gate, bookings, shop settings) |
| `lib/` | `api.ts` (fetch client + types), `auth.tsx`, `firebase.ts`, `shop-context.tsx`, `today.ts`, flags (`companion-flag.ts`, `plan-gating.ts`) |
| `src/config/brand.ts` | Brand config (River rules path); `productSlug` matches the backend |

## Feature flags

| Flag | Where | Effect |
| :--- | :--- | :--- |
| `PLAN_GATING_ENABLED` | Functions (`config/plan-gating.ts`) and App Hosting (`lib/plan-gating.ts` via `NEXT_PUBLIC_PLAN_GATING_ENABLED`) | `"1"` enforces Partner limits (10 walk-ins/day, 10 companion questions/month, Pro-only companion tools/tips/alerts, Paid-only routes: bays, customers, sales). Anything else (current: `0` on dev and prod) unlocks everything for every plan. Plan data and billing stay intact. |
| `COMPANION_ENABLED` | App Hosting (`lib/companion-flag.ts`); functions use `environments.ts` (`dev` on, `prod` only with `COMPANION_ENABLED=1` or `INSIGHTS_PROD_ENABLED=true`) | AI Companion UI and API. Dev on, prod off. |
| `devTools` | `environments.ts` (dev only) | Dev helpers such as forcing the weekly tips run. |

## Plans

`partner` (entry) and `paid` (Pro monthly or Lifetime). Only a platform admin
(`platformAdmin` custom claim) can change a shop's plan or activate billing. With gating off,
plans are recorded but do not limit features.
