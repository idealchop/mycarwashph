# Auth flow

## Sign-in (frontend)

- Firebase Auth only (`frontend/lib/auth.tsx`, `lib/firebase.ts`): phone (SMS with reCAPTCHA) and Google.
  Local development uses the Auth emulator (`NEXT_PUBLIC_USE_EMULATORS`); hosted dev and prod never do.
- The app sends the user's Firebase ID token as `Authorization: Bearer <token>` on every `/api/*` call
  (`lib/api.ts`). The App Hosting proxy forwards it untouched and adds its own service ID token in
  `X-Serverless-Authorization` for Cloud Run IAM.
- Guests can browse Home and Moments; actions open the sign-in sheet (`components/auth/auth-gate`).

## Identity (backend)

`requireAuth` (`middleware/auth-middleware.ts`) verifies the ID token with the Admin SDK
(`FirebaseTokenVerifier`) and sets `AuthUser { uid, phoneNumber, email, name, platformAdmin }`.
`platformAdmin` is the custom claim `platformAdmin: true` (River Apps staff); it is the only way to
change a shop's plan (`PUT /businesses/:id/plan`) or activate billing (`PUT /businesses/:id/billing/activate`).

## Tenant (shop) resolution

The tenant is **never** taken from client input alone:

1. `GET /me` lists the caller's shops from their own `members` docs (collection-group query on `uid`).
2. The app picks one (`currentShop` in `localStorage` is only a **hint**; `lib/shop-context.tsx`
   falls back to the first shop the server returned) and calls `/businesses/{businessId}/...`.
3. `requireMembership` (`middleware/business-middleware.ts`) reads
   `businesses/{businessId}/members/{uid}` for the verified uid and rejects with the same `403` when it is
   missing, inactive, for another business, or has the wrong role, so ids cannot be probed. Only then is the
   business loaded into the request context; every service call uses that context's id.
4. Ids inside request bodies are checked against the same shop before use: service ids (pricing),
   bay ids (queue start), customer ids (walk-ins), queue item and booking ids (sales), the shop id inside
   a check-in QR (`verifyScan`), photo paths (deletes) and the posting shop for Moments.

Roles: `owner` (settings, services, bays, members, billing, companion, audit logs) and `staff`
(queue, bookings, scan, sales). Plan checks (`requirePlan`) apply only when `PLAN_GATING_ENABLED=1`.

New shops: `POST /businesses` creates the business and the caller's `owner` membership in one
transaction (plus the starter services). Staff join by accepting an invite (`/invites/:id/accept`).

## `/v1` partner API (River Mobile)

Server to server with an API key: `Authorization: Bearer <key>`. `requireApiClient` hashes the key with the
environment's pepper (Secret Manager `API_KEY_PEPPER_DEV` / `_PROD`) and looks up `api_clients`;
`requireScope` checks `shops:read`, `bookings:write`, `bookings:read`, `checkin:write`.
Shops are only visible when `riverMobile.listed` is on. A booking is tied to the creating client via
`api_booking_index`, so a client can only read or check in its own bookings. Details: [api.md](./api.md).
