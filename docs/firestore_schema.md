# Firestore schema

Source of truth for types: `backend/functions/src/models/types.ts` (paths: `services/paths.ts`,
`services/companion/store.ts`, `services/moments-service.ts`). Two **named databases** in project
`mycarwashph` with the same schema: `mycarwash-dev` and `mycarwash-prod` (see [environments.md](./environments.md)).

Conventions: money is integer **centavos**; timestamps are ISO 8601 UTC strings written by the server;
shop-facing times render in PHT. Only the API (Admin SDK) writes. Every business document lives under
`businesses/{businessId}` (the tenant segment).

## Tenant: `businesses/{businessId}`

| Field | Notes |
| :--- | :--- |
| `name`, `ownerUid`, `phoneE164`, `address`, `location {lat,lng,formattedAddress,placeId}`, `photoUrls[]`, `logoUrl` | Shop profile |
| `plan` (`partner` \| `paid`), `planStatus` (`active` \| `suspended`), `billing {partnerOption,status,lastPayment,activatedAt,expiresAt,checkoutProvider}` | Plan + billing records (kept even while plan gating is off) |
| `riverMobile {listed, listedAt}` | Opt-in to River Mobile (`/v1`) listing |
| `bookingCapacity`, `settings` | Booking slots, daily target |
| `deletedAt` | Set when the owner removes the shop (soft delete) |
| `starterServicesAt` | Set once the starter menu was seeded or the backfill checked the shop |
| `createdAt`, `updatedAt` | |

### Subcollections

| Path | Contents |
| :--- | :--- |
| `members/{uid}` | `uid, businessId, role (owner\|staff), status (active\|…), displayName, phoneE164, email, invitedBy`. **The tenant wall** reads this doc. |
| `invites/{inviteId}` | Staff invites (owner-created) |
| `services/{serviceId}` | `name, category (car-wash\|interior\|detailing\|wax-coating\|engine\|add-ons; missing = car-wash), icon?, pricesBySize {small,medium,large,xl}, active, listedOnRiverMobile, durationMins? (legacy, not shown)` |
| `bays/{bayId}` | `name, active, sortOrder` |
| `customers/{customerId}` | Customer records (name, phone; `plate` legacy, no longer collected) |
| `bookings/{bookingId}` | `reference (CWS-…), source, status (requested→accepted→checked_in→completed, or into the queue), serviceIds, vehicleSize, scheduledStart, customerSnapshot {name, phoneE164}, verifyCodeHash, external {clientId, customerRef, externalBookingRef}, notes, queueItemId, linkTokenHash? + payPref? (booking-link bookings, source online_link)` |
| `queue/{queueItemId}` | `queueNumber, status (queued\|in_bay\|done\|paid\|closed\|cancelled), bayId, serviceIds, vehicleSize, lines[{serviceId,name,priceCentavos}], totalCentavos, customerName, notes, customerId, source (staff\|booking), bookingId, startedAt, doneAt, paidAt, paymentMethod` |
| `sales/{saleId}` | `queueItemId, bookingId, amountCentavos, method (cash\|gcash\|maya\|other), paymentRef, serviceIds, vehicleSize, customerName, recordedBy, paidAt` |
| `counters/walkins-{YYYYMMDD}`, `counters/queue-{YYYYMMDD}` | Walk-in count (Partner limit) and queue numbers per Manila day |
| `alerts/{alertId}` | In-app notifications |
| `app_feedback/{uid}` | Install page rating: `uid, rating (1–5), comment, createdAt, updatedAt`; one per member per shop, edits replace it |
| `audit_logs/{logId}` | `actor {type,id}, action, target, meta, createdAt` for every mutation |
| `insights/{weekId}` | AI Companion: record of each Monday tips run (tips, alerts, cost) |
| `companion/threads/messages/{msgId}` | AI Companion chat (roles owner, companion, tip, alert) |
| `companion/goals`, `companion/usage` | Companion goals; per-month/per-week question counts and Gemini cost |

## Top-level collections

| Path | Contents | Access |
| :--- | :--- | :--- |
| `invite_index/{inviteId}` | Invite id → business, for accept links | Server only |
| `moments/{momentId}` | Shop community posts (`businessId`, body, images, likedBy, repostedBy, replies) | Read via `GET /moments` (public); writes by members of the posting shop |
| `app_stats/feedback` | `count, sum` of all app ratings (Install page stats; placeholders until 20 ratings) | Server only |
| `api_clients/{clientId}` | `/v1` partner clients: `name, environment, scopes, secretHash, status` | Server only |
| `api_booking_index/{bookingId}` | `businessId, clientId, customerRef` (ties a `/v1` booking to its client) | Server only |
| `api_idempotency/{keyHash}` | `/v1` POST idempotency records | Server only |

## Rules (`firestore.rules`)

All client writes are denied. Client reads are allowed only for active members of a business
(`businesses/{id}`, `members`, owner-only `audit_logs`, and `services`/`bays`/`customers`/`queue`),
plus a user's own memberships. `bookings`, `counters` and all platform collections are server-only.
The web app does **not** use these read permissions today (no Firestore SDK in the frontend); see
[hybrid-read-model.md](./hybrid-read-model.md).
