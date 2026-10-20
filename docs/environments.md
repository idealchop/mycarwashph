# Environments

## Today: one Firebase project, two environments

| | Dev | Prod |
| :--- | :--- | :--- |
| Firebase project | `mycarwashph` | `mycarwashph` (same) |
| Firestore database (named) | `mycarwash-dev` | `mycarwash-prod` |
| App Hosting backend | `mycarwash-dev` (`https://mycarwash-dev--mycarwashph.asia-southeast1.hosted.app`) | `mycarwash-prod` (`https://mycarwash-prod--mycarwashph.asia-southeast1.hosted.app`, domain `mycarwash.ph`) |
| Shop API function | `mycarwashApiDev` | `mycarwashApiProd` |
| `/v1` partner API function | `mycarwashPublicApiDev` | `mycarwashPublicApiProd` |
| Weekly companion scheduler | `mycarwashCompanionWeeklyDev` | `mycarwashCompanionWeeklyProd` (exits unless companion enabled) |
| `/v1` key pepper (Secret Manager) | `API_KEY_PEPPER_DEV` | `API_KEY_PEPPER_PROD` |
| App Hosting env file | `frontend/apphosting.dev.yaml` | `frontend/apphosting.prod.yaml` |

Both environments share Firebase Auth users, Storage bucket and the single functions deployment
(codebase `mycarwash`, region `asia-southeast1`). The dev/prod matrix lives in
`backend/functions/src/config/environments.ts`. **Planned:** a separate Firebase project for dev, so dev
and prod stop sharing Auth, Storage and the functions deploy. Until then, treat every functions deploy as
touching prod too.

Branches: `dev` → Dev, `main` → Prod (River rules). App Hosting has no connected repo; deploys run
from local source with the Firebase CLI.

## Variables

### App Hosting (`frontend/apphosting*.yaml`, BUILD + RUNTIME unless noted)

| Variable | Dev | Prod | Purpose |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_ENV` | `dev` | `prod` | Environment label (robots, emulator guard) |
| `API_UPSTREAM_URL` (runtime) | Dev shop API Cloud Run URL | Prod shop API URL | Target of the `/api/*` proxy |
| `PUBLIC_API_UPSTREAM_URL` (runtime) | Dev `/v1` URL | Prod `/v1` URL | Target of the `/v1/*` proxy |
| `COMPANION_ENABLED` | `"1"` | `"0"` | AI Companion UI (`NEXT_PUBLIC_COMPANION_ENABLED` via `next.config.ts`) |
| `PLAN_GATING_ENABLED` | `"0"` | `"0"` | Plan limits UI (`NEXT_PUBLIC_PLAN_GATING_ENABLED`). `0` = all features for all plans (decision Oct 15, 2026). |
| `NEXT_PUBLIC_USE_EMULATORS` | `false` (`apphosting.yaml`) | `false` | Never use emulators when hosted |
| `FIREBASE_WEBAPP_CONFIG` | injected by App Hosting | injected | Firebase web config → `NEXT_PUBLIC_FIREBASE_*` in `next.config.ts` |

Local: copy `frontend/.env.example` to `frontend/.env.local`.

### Functions (`backend/functions`)

| Variable | Value | Purpose |
| :--- | :--- | :--- |
| `PLAN_GATING_ENABLED` | `0` (dev and prod) | `"1"` enforces Partner limits server-side; unset or anything else = off |
| `COMPANION_ENABLED` / `INSIGHTS_PROD_ENABLED` | unset | Turns the companion on for **prod** functions (dev is always on) |
| `COMPANION_MODEL`, `COMPANION_LOCATION` | optional | Gemini model / Vertex location overrides |
| `SHOP_PHOTOS_BUCKET` | optional | Storage bucket for photo uploads |
| `ALLOWED_ORIGINS`, `API_KEY_PEPPER` | emulator only | Local overrides |

Functions env files are **not committed** (`.gitignore` covers `.env.*` except `.env.example`). Firebase
loads `backend/functions/.env.mycarwashph` (project-specific) at deploy time, so the deployer keeps an
**untracked** copy of that file with:

```
PLAN_GATING_ENABLED=0
```

Because dev and prod functions deploy together from one project, that file applies to both. If the file
is missing, `PLAN_GATING_ENABLED` is unset, which also means gating off. Documented keys and comments:
`backend/functions/.env.example`.

## Deploy (from local source)

Order: functions (API) first, then App Hosting dev, then prod.

```bash
firebase deploy --only functions:mycarwash --project mycarwashph   # deploys Dev + Prod functions
firebase deploy --only apphosting:mycarwash-dev --project mycarwashph
firebase deploy --only apphosting:mycarwash-prod --project mycarwashph
```

Use your own `firebase login`; never deploy with saved CI tokens. Firestore rules and indexes deploy to both
databases from `firebase.json`.
