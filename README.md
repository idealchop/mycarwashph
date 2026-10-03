# Mycarwash.ph

Standalone car wash management web app by **River Apps** for shop owners and
staff. Web only (desktop and phone browsers, mobile-first).

> Work in progress: Phase 0 scaffold. Full setup docs land with the next milestones.

- `frontend/`: Next.js 16 App Router + React 19 + Tailwind 4 web app
- `backend/functions/`: Express API on Firebase Cloud Functions v2 + Firestore
- `packages/`: vendored River Apps UI Kit (`@river-apps/tokens`, `icons`, `ui`), see `packages/VENDORED.md`

```bash
pnpm install
pnpm build:packages
pnpm dev        # http://localhost:3000
```
