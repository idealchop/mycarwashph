# Mycarwash.ph API

Two HTTP APIs run as Firebase Cloud Functions v2 (Node 22, `asia-southeast1`),
both Express apps in `backend/functions`:

Each API is deployed once per environment in Firebase project `mycarwashph`;
the dev functions use Firestore database `mycarwash-dev`, the prod functions
`mycarwash-prod`.

| API | Who calls it | Auth | dev | prod |
|---|---|---|---|---|
| Shop API | Shop web app (owners, staff) | Firebase ID token | `mycarwashApiDev` | `mycarwashApiProd` |
| Partner API (`/v1`) | River Mobile backend (server to server) | API key (placeholder) | `mycarwashPublicApiDev` | `mycarwashPublicApiProd` |

**Access (org policy):** Cloud Functions are **private** (no `allUsers` invoker).
Browsers and partners reach them through App Hosting same-origin proxies:

| Caller | Path on App Hosting | Upstream function |
|---|---|---|
| Shop web app | `/api/*` | `mycarwashApiDev` / `mycarwashApiProd` |
| River Mobile | `/v1/*` | `mycarwashPublicApiDev` / `mycarwashPublicApiProd` |

Direct Cloud Run URLs remain for the proxy only (Google ID token). Emulator:
`http://127.0.0.1:5001/demo-mycarwash/asia-southeast1/<function>`.
Custom domain: see [custom-domain.md](./custom-domain.md).

## Conventions

- JSON in and out. Money is integer **centavos**. Timestamps are ISO 8601.
  Stored timestamps are UTC; shop-facing values are shown in PHT (UTC+8).
- Errors use RFC 7807 `application/problem+json`:
  ```json
  { "type": "https://mycarwash.ph/problems/forbidden", "title": "You do not have access to this shop.",
    "status": 403, "code": "forbidden", "instance": "/businesses/abc" }
  ```
  Validation errors add `errors: [{ path, message }]`.
- Rate limits are per function instance (`express-rate-limit`): 300/min for the
  shop API, 120/min for `/v1`. A shared counter or gateway quota is a Phase 1 item.
- Dual-endpoint rule (River Kit): every mutation domain also has a `GET`.

## Shop API (`mycarwashApiDev` / `mycarwashApiProd`)

Send `Authorization: Bearer <Firebase ID token>`. The token comes from Firebase
Auth (phone SMS code or Google) in the web app.

### Tenancy

Every route under `/businesses/:businessId` runs `requireMembership` first. It
reads `businesses/{businessId}/members/{uid}` and allows the request only if the
membership exists, is `active`, belongs to that business and has an allowed role.
Unknown businesses and businesses you are not a member of both return `403`.
Nothing is created on read. Removing a member revokes access immediately.

Roles: **owner** (everything the plan allows) and **staff** (bookings, scan,
queue; no price edits, no deletes, no audit log). Plans: **partner** and **paid**;
Paid-only routes return `402 plan_required` on Partner shops. Plan prices are TBD
and are not in the code.

### Routes

| Method & path | Role | Plan | Purpose |
|---|---|---|---|
| `GET /health` | none | | Liveness |
| `GET /me` | signed in | | Current user + shops they belong to |
| `GET /businesses` | signed in | | Shops I belong to |
| `POST /businesses` | signed in | | Create a shop; caller becomes **owner**; starts on Partner |
| `GET /businesses/:id` | owner, staff | | Shop profile + my role |
| `PATCH /businesses/:id` | owner | | Name, phone, address, `location` `{lat,lng,formattedAddress,placeId}`, `riverMobileListed`, `bookingCapacity`, `dailyTargetCentavos` |
| `PUT /businesses/:id/plan` | platform admin | | Switch `partner` / `paid` (custom claim `platformAdmin`) |
| `GET /businesses/:id/members` | owner, staff | | Team |
| `DELETE /businesses/:id/members/:uid` | owner | | Remove staff (owner cannot be removed) |
| `DELETE /businesses/:id` | owner | | Remove the shop (soft delete: `deletedAt`, members deactivated, River Mobile listing off) |
| `GET /businesses/:id/feedback` | owner, staff | | App rating summary + my rating (Install page) |
| `POST /businesses/:id/feedback` | owner, staff | | Save my app rating `{ rating: 1-5, comment? }` (replaces an earlier one) |
| `GET /businesses/:id/services` | owner, staff | | Service menu |
| `POST /businesses/:id/services` | owner | | Add service (`pricesBySize` in centavos, owner-entered) |
| `PATCH /businesses/:id/services/:serviceId` | owner | | Edit service |
| `GET /businesses/:id/bookings?status=` | owner, staff | | Bookings (newest first) |
| `GET /businesses/:id/bookings/:bookingId` | owner, staff | | Booking detail |
| `POST /businesses/:id/bookings/:bookingId/accept` | owner, staff | | `requested → accepted` |
| `POST /businesses/:id/bookings/:bookingId/decline` | owner, staff | | `requested → declined` |
| `POST /businesses/:id/bookings/:bookingId/complete` | owner, staff | partner | `checked_in → completed` (mark served) |
| `POST /businesses/:id/bookings/verify` | owner, staff | | **Scan**: verify a customer's check-in QR (below) |
| `GET /businesses/:id/bays` | owner, staff | paid | Bays |
| `POST /businesses/:id/bays`, `PATCH .../bays/:bayId` | owner | paid | Manage bays |
| `GET /businesses/:id/customers` | owner, staff | paid | Customers |
| `POST /businesses/:id/customers` | owner, staff | paid | Add customer |
| `GET /businesses/:id/queue?date=YYYYMMDD` | owner, staff | paid | Today's queue (Manila day) |
| `POST /businesses/:id/queue` | owner, staff | paid | Staff-created walk-in; allocates the daily number |
| `PATCH /businesses/:id/queue/:queueItemId` | owner, staff | paid | Assign bay, move `queued → in_bay → done → paid → closed` |
| `GET /businesses/:id/audit-logs` | owner | | Last 100 audit entries |
| `POST /businesses/:id/members/invites` | owner | | Invite staff by PH phone and/or email |
| `GET /businesses/:id/members/invites` | owner | | Pending invites |
| `DELETE /businesses/:id/members/invites/:inviteId` | owner | | Revoke invite |
| `GET /invites/:inviteId` | signed in | | Invite preview |
| `POST /invites/:inviteId/accept` | signed in | | Accept invite (phone/email must match) |
| `GET /businesses/:id/sales` | owner, staff | paid | List sales (newest first) |
| `GET /businesses/:id/sales/summary?date=` | owner, staff | paid | Today totals, by hour, recent |
| `POST /businesses/:id/sales` | owner, staff | paid | Record a sale manually |
| `PATCH /businesses/:id/queue/:id` + `sale` | owner, staff | paid | When status → `paid`, body must include `sale` |
| `GET /businesses/:id/alerts` | owner, staff | | In-app Messages / alerts |
| `POST /businesses/:id/alerts/:id/read` | owner, staff | | Mark alert read |
| `GET /businesses/:id/growth` | owner, staff | | Metrics from live bookings/queue/sales |
| `PATCH /businesses/:id` `dailyTargetCentavos` | owner | | Daily sales target (centavos, nullable) |
| `GET /businesses/:id/billing` | owner, staff | | Billing status + Partner price catalog |
| `POST /businesses/:id/billing/select` | owner | partner | Choose Partner `monthly` (₱950) or `lifetime` (₱10,000) |
| `POST /businesses/:id/billing/confirm-payment` | owner | partner | Record GCash/Maya/bank payment + reference → `pending` |
| `PUT /businesses/:id/billing/activate` | platform admin | | Mark billing `active` / `suspended` / `unpaid` |

### Scan (shop-side verification)

River Mobile shows the customer a QR with payload
`MCW1.<businessId>.<bookingId>.<code>` (8-character code, only its hash is stored).
Staff scan it and the app calls:

```http
POST /businesses/{businessId}/bookings/verify
{ "payload": "MCW1.shopA.bk123.7KQ2M9XD" }
```

Results: `200` with `{ booking, queueItem }`; `422 invalid_qr`, `422 wrong_shop`,
`422 verification_failed`; `409 not_accepted` (accept first) or
`409 already_processed`. Partner shops go to `checked_in`; Paid shops also get a
queue item with the day's next number and the booking moves to `queued`.

## River Mobile API (`/v1`, `mycarwashPublicApiDev` / `mycarwashPublicApiProd`)

Server to server only: River Mobile's app talks to the **River Bridge** (River
Mobile's backend, `idealchop/River-Mobile-App` `functions/`), and only the Bridge
calls this API. Mycarwash and River Mobile share no database or user table. The
contract is the Bridge's `docs/partner-api/openapi.yaml`; this app's verifier is
the vendored `backend/functions/src/river/bridge-kit/` (unchanged logic).

Public entry: `https://mycarwash-dev--mycarwashph.asia-southeast1.hosted.app/v1/*`
(App Hosting proxy `frontend/app/v1/[...path]/route.ts` → private Cloud Run
`mycarwashPublicApiDev`). **Dev only for now.** The prod partner API has no River
config and answers `401` to everything except `/v1/health` (fail closed).

### Auth: two factors on every call (except `GET /v1/health`)

1. **OIDC.** `Authorization: Bearer <Google-signed ID token>` from the Bridge
   service account. `aud` must be exactly the dev origin
   `https://mycarwash-dev--mycarwashph.asia-southeast1.hosted.app` (no `/v1`);
   tokens for prod or any other audience are refused. The `email` must be in
   `RIVER_DEV_BRIDGE_EMAILS`. There is **no API-key fallback**; the old `mcw_`
   keys and `api_clients` lookup are gone.
2. **HMAC.** `X-River-Signature: v1=<hex>` = HMAC-SHA256 over
   `v1\nMETHOD\nPATH?SORTED_QUERY\nX-River-Timestamp\nX-River-Nonce\nhex(sha256(raw body))`,
   plus `X-River-Key-Id`, `X-River-Timestamp` (unix seconds, ±5 min) and
   `X-River-Nonce` (UUID v4, single use for 10 min in the shared Firestore store
   `river_nonces/{sha256(keyId\nnonce)}`, TTL on `expireAt`). Two active request
   secrets (`bridge-to-carwash-dev-v1` / `-v2`, Secret Manager
   `RIVER_BRIDGE_REQUEST_HMAC_DEV_V1` / `_V2`). Constant-time comparison.

Writes need `Idempotency-Key` (8–128 of `A-Za-z0-9_.:-`); same key + body replays
with `Idempotent-Replayed: true`, a different body is `422`. Bodies over 16 KB are
`413`. HTTPS only. Auth failures are generic `application/problem+json`
(`unauthorized` / `forbidden`); the reason is only in the `river_auth` log line
(method, path, key id, caller email, result, reason; never tokens or secrets).

Scopes granted to the Bridge (`RIVER_DEV_SCOPES`): `shops:read`, `orders:read`,
`orders:write`, `checkin:write`. Only listed, active shops are visible, and the
Bridge only sees bookings it created (`api_booking_index`).

### Endpoints

| Method & path | Scope | Purpose |
|---|---|---|
| `GET /v1/health` | none | Liveness, `apiVersion` |
| `GET /v1/shops?lat&lng&radiusKm&limit&cursor` | `shops:read` | **Near me**: listed, active shops with a map pin, nearest first, `distanceKm`; `radiusKm` ≤ 200 (default 10), `limit` 1–50 (default 20); `{ shops, nextCursor }` |
| `GET /v1/shops/{shopId}` | `shops:read` | Listed shop detail |
| `GET /v1/shops/{shopId}/services` | `shops:read` | Active services listed on River Mobile (prices in centavos) |
| `POST /v1/orders` | `orders:write` | Create (shared `OrderCreate`, `kind: "booking"`) |
| `GET /v1/orders/{orderId}` | `orders:read` | Shared `Order` view (`status` in the shared set) |
| `POST /v1/orders/{orderId}/check-in` | `checkin:write` | Customer scanned the shop QR |
| `POST /v1/orders/{orderId}/cancel` | `orders:write` | Customer cancel while `requested` or `accepted`; repeat = `200` |
| `POST /v1/bookings` | `orders:write` | Legacy create (the Bridge's current Carwash adapter) |
| `GET /v1/bookings/{bookingId}` | `orders:read` | Legacy view (`status` = Carwash status, plus `riverStatus`) |
| `POST /v1/bookings/{bookingId}/check-in` | `checkin:write` | Legacy check-in |
| `POST /v1/bookings/{bookingId}/cancel` | `orders:write` | Same as orders cancel |

All creates write `businesses/{shopId}/bookings/{id}` with `source: "river_mobile"`
(older rows keep `river_mobile_api`; both map to the same statuses), so owners see
them live. Plates are accepted for compatibility but never stored.

The near-me list uses the denormalized `businesses.riverGeo` geohash (set while a
shop is listed with a map pin, cleared when unlisted or removed). One range query
per covering geohash cell (≤ 9 cells × 60 docs), index
`businesses (planStatus ASC, riverGeo ASC)`. Shops listed before this change get
`riverGeo` the next time the owner saves the shop (or a one-off backfill).

#### POST /v1/bookings (legacy body)

```json
{
  "shopId": "shopA",
  "serviceIds": ["svc1"],
  "vehicleSize": "medium",
  "slotStart": "2026-10-10T15:00:00+08:00",
  "customer": { "ref": "rm-opaque-customer-id", "name": "Juan Dela Cruz", "phoneE164": "+639181112222" },
  "externalBookingRef": "RM-123",
  "notes": "Optional"
}
```

`201`: `{ bookingId, reference, status: "requested", riverStatus, source: "river_mobile", shopId, checkIn: { code, qrPayload }, createdAt }`.

### Status mapping (shared set)

| Carwash | River |
|---|---|
| `requested` | `requested` |
| `accepted` | `accepted` |
| `checked_in`, `queued`, `in_bay` | `in_progress` |
| `done` | `ready` |
| `completed`, `paid`, `closed` | `completed` |
| `declined` | `declined` |
| `cancelled`, `no_show` | `cancelled` |

On Paid shops the booking now follows its queue item (`in_bay`, `done`, `paid`, `closed`, `cancelled`).

### Status webhooks (app → Bridge)

`mycarwashRiverWebhookDev` (Firestore trigger on `businesses/{id}/bookings/{id}`
updates in `mycarwash-dev`; no polling) sends `order.<status>` when the shared status
changes on a River Mobile booking, to `{RIVER_DEV_BRIDGE_BASE_URL}/hooks/carwash`.
Factor 1 is this function's service-account OIDC token (aud = that exact URL);
factor 2 is the webhook-direction HMAC (`carwash-to-bridge-dev-v1` / `-v2`, Secret
Manager `RIVER_BRIDGE_WEBHOOK_HMAC_DEV_V1` / `_V2`, `RIVER_DEV_WEBHOOK_ACTIVE`
picks which signs), signed over the path from `/hooks/` (`/hooks/carwash`), as the
Bridge verifies it. `Idempotency-Key` = event id `mcw.<bookingId>.<status>`. Up to
3 attempts (network, 408, 429, 5xx); outcome in `river_webhook_deliveries/{eventId}`
(`delivered`, `failed`, `not_configured`).

The trigger runs as the dedicated service account
`carwash-runtime@mycarwashph.iam.gserviceaccount.com` (not the project-default
compute account); that email is what the Bridge allowlists for webhooks. Least
privilege for it: `roles/datastore.user` (read bookings / write delivery records in
`mycarwash-dev`), `roles/logging.logWriter`, `roles/eventarc.eventReceiver` and
`roles/run.invoker` (Eventarc delivers the Firestore event to the function), and
`roles/secretmanager.secretAccessor` on the two `RIVER_BRIDGE_WEBHOOK_HMAC_DEV_*`
secrets only. Minting its own OIDC token needs no extra role (metadata server).

### Conformance

`pnpm --filter @mycarwash/functions conformance` runs the bridge-kit prod-key
checklist against this app's real `/v1` routes over HTTP (test-only secrets and a
stand-in for Google's token check), plus the webhook direction.

### Not built yet

`GET /v1/shops/{id}/catalog` and `/availability` (shared names); signed shop QR
with a time window; idempotency record expiry; River config for prod.

## Notifications

`notifyShop` always writes `businesses/{id}/alerts/{alertId}` (Messages UI).
Email/SMS are **stubs** that `console.info` until provider env vars are attached
(e.g. SendGrid / SMS gateway). No provider secrets are committed.

## Payments

Sales store `method: cash | gcash | maya | other`, optional `paymentRef` and
`paymentQrPayload` (public QR string for staff to show — not a secret). A future
PSP can set `paymentRef` to the processor id after webhook confirmation.


## Shop location (River Mobile)

Businesses store `address` (text) and optional `location: { lat, lng, formattedAddress, placeId }`.
The shop web app sets the pin with **River Maps** (MapLibre GL + River's self-hosted Philippines
PMTiles, vendored as `packages/river-map` from `idealchop/river-maps@f7989dc`): owners drag the pin,
tap the map or use the device location; `placeId` is `null` (no Google Places). Listed shops expose
`address`, `location` and `photoUrls` on `GET /v1/shops/{shopId}` so River Mobile can find nearby
shops and draw them on the same River style.

## Partner billing

Owners choose monthly vs lifetime Partner packages, then record a manual payment
(GCash / Maya / bank + reference). Status flow: `trial` → `unpaid` → `pending` →
`active` (platform admin activates). No live PSP charge without provider keys;
`checkoutProvider: manual|stub` is reserved for Xendit/PayMongo later.

## Booking link (no sign-in, shop API)

The public `/book?shop=<id>` page behind the shop QR. Mounted before `requireAuth`; POST is rate-limited to 10/min per IP.

| Endpoint | Purpose |
| :--- | :--- |
| `GET /public/shops/:shopId` | Shop name, address, logo, active services (category, icon, `pricesBySize`), `onlineCheckout` flag |
| `POST /public/shops/:shopId/bookings` | `{ serviceIds, vehicleSize, scheduledStart?, name?, contact?, notes?, payPref? }` → `requested` booking with `source: "online_link"`; returns `token` + check-in `qrPayload` |
| `GET /public/shops/:shopId/bookings/:bookingId?t=<token>` | Customer ticket: `stage` (sent, accepted, in_bay, done, closed), queue number, lines, total |

`payPref: "online"` is only kept when the functions env has `ONLINE_CHECKOUT_ENABLED=1` (no payment provider yet; default off).

### Expenses and week calendar (v0.5.0)

- `GET /businesses/{id}/finance/week?date=YYYYMMDD` — Mon–Sun week holding `date` (default today, Manila): `days[]` with `salesCentavos`, `cars`, `expensesCentavos`, `profitCentavos` (sales − expenses), `totals`, and the week's `expenses[]`. Member only.
- `POST /businesses/{id}/expenses` — `{ amountCentavos > 0, note (1–80), date? YYYYMMDD }`. Member only. Audited (`expense.create`).
- `DELETE /businesses/{id}/expenses/{expenseId}` — 204; 404 if not in this shop. Audited (`expense.delete`).
- Stored at `businesses/{id}/expenses/{expenseId}`; Firestore rules deny all client reads/writes (API-only).
