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

Server to server only: the River Mobile app talks to River Mobile's backend,
which holds the Mycarwash credentials. Mycarwash and River Mobile share no
database or user table; this API is the only connection.

### Auth (placeholder)

`Authorization: Bearer mcw_<clientId>_<secret>`. The key is checked against
`api_clients/{clientId}` in that environment's database (`secretHash = sha256(pepper:secret)`,
with the pepper from Secret Manager `API_KEY_PEPPER_DEV` / `_PROD`; `status`,
`scopes`). Scopes: `shops:read`, `bookings:write`, `bookings:read`, `checkin:write`.
Phase 1 replaces this with OAuth 2.0 client credentials (`POST /v1/oauth/token`,
short-lived tokens) as proposed in the plan (§3.9.1).

Only shops with `riverMobile.listed = true` are visible or bookable, and a client
can only read bookings it created.

### Endpoints

| Method & path | Scope | Purpose |
|---|---|---|
| `GET /v1/health` | none | Liveness, `apiVersion` |
| `GET /v1/shops/{shopId}` | `shops:read` | Listed shop detail (`address`, `location` `{lat,lng,formattedAddress}`, phone) |
| `GET /v1/shops/{shopId}/services` | `shops:read` | Active services listed on River Mobile (prices in centavos) |
| `POST /v1/bookings` | `bookings:write` | **Receive a booking** (requires `Idempotency-Key`) |
| `GET /v1/bookings/{bookingId}` | `bookings:read` | Booking status (only bookings this client created) |
| `POST /v1/bookings/{bookingId}/check-in` | `checkin:write` | **Customer verify**: customer scanned the shop QR |

#### POST /v1/bookings

```http
POST /v1/bookings
Authorization: Bearer mcw_river-mobile_<secret>
Idempotency-Key: 6f1c2b8e-booking-001
Content-Type: application/json

{
  "shopId": "shopA",
  "serviceIds": ["svc1"],
  "vehicleSize": "medium",
  "plate": "NAB 1234",
  "slotStart": "2026-10-10T15:00:00+08:00",
  "customer": { "ref": "rm-opaque-customer-id", "name": "Juan Dela Cruz", "phoneE164": "+639181112222" },
  "externalBookingRef": "RM-123",
  "notes": "Optional"
}
```

`201 Created`:

```json
{
  "bookingId": "bk123",
  "reference": "CWS-7KQ2M9",
  "status": "requested",
  "shopId": "shopA",
  "checkIn": { "code": "7KQ2M9XD", "qrPayload": "MCW1.shopA.bk123.7KQ2M9XD" },
  "createdAt": "2026-10-04T02:00:00.000Z"
}
```

Repeating the same `Idempotency-Key` with the same body returns the stored
response with `Idempotent-Replayed: true`; a different body returns
`422 idempotency_key_reused`. Errors: `400` validation, `401` bad key, `403`
missing scope, `404` shop not listed, `422 invalid_service`.

#### POST /v1/bookings/{bookingId}/check-in

```json
{ "shopQr": "MCW-SHOP.shopA" }
```

The printed shop QR payload is a placeholder (`MCW-SHOP.<shopId>`, unsigned).
The booking must be `accepted`. Returns the booking view with
`status: "checked_in"`. Errors: `403` QR for another shop, `409 invalid_status`,
`422 invalid_qr`.

### Booking statuses

`requested → accepted | declined | cancelled`; `accepted → checked_in | cancelled | no_show`;
Partner: `checked_in → completed`. Paid: `checked_in → queued → in_bay → done → paid → closed`.

### Not built yet (Phase 1)

OAuth client credentials and token endpoint; shared rate-limit counter; shop list
and availability; list and cancel bookings; signed shop QR with time window;
webhooks to River Mobile (`booking.accepted`, `.declined`, `.checked_in`,
`.completed`, `.cancelled`, `.no_show`, HMAC-SHA256 signed, retried, delivery log);
idempotency key expiry; OpenAPI spec and Swagger UI; admin console for API clients.


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
The shop web app uses Google Maps Places (when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set) or
manual lat/lng fields. Listed shops expose `address` + `location` on `GET /v1/shops/{shopId}`
so River Mobile can detect nearby shops.

## Partner billing

Owners choose monthly vs lifetime Partner packages, then record a manual payment
(GCash / Maya / bank + reference). Status flow: `trial` → `unpaid` → `pending` →
`active` (platform admin activates). No live PSP charge without provider keys;
`checkoutProvider: manual|stub` is reserved for Xendit/PayMongo later.
