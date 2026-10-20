# AGENTS.md: Mycarwash.ph

Rules: [idealchop/river-ai-rules](https://github.com/idealchop/river-ai-rules) (shape **A**, monorepo FE + API).
Docs index: [docs/README.md](./docs/README.md). Read the matching doc before changing schema, auth, env or architecture,
and update it in the same change.

## Layout

- `frontend/`: Next.js 16 on App Hosting. UI and API reads only; Firebase Auth client for sign-in.
- `backend/functions/`: Express on Cloud Functions v2 (Node 22), codebase `mycarwash`. All writes, audit, AI.
- `packages/`: River UI kit (`@river-apps/ui`, `icons`, `tokens`).
- Brand: `frontend/src/config/brand.ts` and `backend/functions/src/config/brand.ts` (`productSlug: "mycarwash"`, keep aligned; a test checks it).

## Must

- No Firestore writes (or reads) from the browser; see `docs/hybrid-read-model.md`.
- Tenant from auth + membership only: routes under `/businesses/:businessId` use `requireMembership`; ids in bodies must be checked against that shop.
- Every mutation audited; dual GET for every mutation domain; problem+json errors.
- Flags: `PLAN_GATING_ENABLED` stays `0` on dev and prod until Jimboy decides otherwise; `COMPANION_ENABLED` is off on prod.
- No secrets or env files in git (`backend/functions/.env.mycarwashph` is local and untracked).
- Branches: `dev` → Dev, `main` → Prod. PRs only; CI must pass.
- Node 22, pnpm (`COREPACK_HOME` as needed). Kebab-case files.

## Commands

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Deploy: see `docs/environments.md` (functions first, then App Hosting dev, then prod; your own `firebase login`).
