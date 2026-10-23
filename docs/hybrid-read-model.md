# Hybrid read model

**Status: no hybrid reads.** The Mycarwash.ph frontend does not import the Firestore SDK and has no
Firestore listeners or `getDoc`/`getDocs` calls. Every screen reads through the shop API (`/api/*` via
`frontend/lib/api.ts`), and every write goes through the API too.

Firebase client SDKs in the frontend (`frontend/lib/firebase.ts`):

| SDK | Use |
| :--- | :--- |
| `firebase/auth` | Sign-in, sign-out, ID tokens ([auth-flow.md](./auth-flow.md)) |
| `firebase/storage` | Initialised only (emulator wiring); uploads go through the API |

| Screen / data | Read model |
| :--- | :--- |
| Home, Queue, History, Sales, Order details | API GET (`/businesses/:id/queue`, `/bookings`, `/sales`, `/sales/summary`, `/queue/:id`, `/bookings/:id`) |
| Settings (shop, services, bays, members, billing) | API GET |
| AI Companion | API GET `/businesses/:id/companion`, `/companion/messages` |
| Moments | API GET `/moments` |
| Account / shop switcher | API GET `/me` |

`firestore.rules` already allow members to read their shop's `services`, `bays`, `customers` and `queue`
so a live listener could be added later. Before adding any frontend Firestore read, document the screen,
path and reason here first (River rules 00-core §9) and keep writes on the API.

## Last-seen cache (PWA rule)

`lib/screen-cache.ts` keeps the last `/me` and every `useLoad` result in localStorage per user. On open the
app paints that data at once (even before Firebase Auth restores the session) and refreshes from the API in
the background; `api()` waits for `authStateReady()` instead of failing. Signing out clears the cache.
Loading placeholders use the `.skeleton` class (visible grey with a shimmer).
