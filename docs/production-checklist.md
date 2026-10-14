# Production checklist (mycarwash-prod)

Project `mycarwashph`, region `asia-southeast1`. Prod web: App Hosting backend `mycarwash-prod`
→ private `mycarwashApiProd` / `mycarwashPublicApiProd` → Firestore database `mycarwash-prod`
(`backend/functions/src/config/environments.ts`, `frontend/apphosting.prod.yaml`, `frontend/lib/upstream.ts`).

## Done in code
- Prod App Hosting env: `NEXT_PUBLIC_APP_ENV=prod`, upstreams to the prod Cloud Run functions, emulators forced off on hosted builds.
- Firebase web config injected via `FIREBASE_WEBAPP_CONFIG` (incl. `storageBucket`); hosted builds log loudly if it is missing.
- Phone OTP uses an invisible reCAPTCHA on hosted builds (`appVerificationDisabledForTesting` only with emulators).
- Firestore rules: clients read their own tenant only, all writes via the API. Storage rules: public read of shop photos, create/delete by the active shop owner only, everything else closed.
- Error boundaries (`app/error.tsx`, `app/global-error.tsx`), 404 (`app/not-found.tsx`), metadata/OG, `robots.txt` (dev never indexed), web manifest, favicon, security headers.
- Guest browse shows fixtures only when signed out; signed-in views load real shop data only.
- Maps: River Maps (MapLibre + PMTiles) from River's public, versioned bucket; no Google key.

## Needs the owner (cannot be done from code)
1. **Firebase Storage → Get started** for `mycarwashph`, then `firebase deploy --only storage`.
2. **Auth authorized domains**: add both `*.hosted.app` URLs and `mycarwash.ph` / `www.mycarwash.ph`; confirm Phone sign-in is enabled and SMS region policy allows PH; set an SMS quota/budget alert.
3. **Custom domain**: connect `mycarwash.ph` to `mycarwash-prod` in App Hosting and add the DNS records (see `docs/custom-domain.md`), then set `NEXT_PUBLIC_SITE_URL`.
4. **Payments (PSP)**: Xendit/PayMongo keys + webhook secret as Secret Manager secrets; until then Partner billing is manual (GCash/Maya reference + admin activation).
5. **Email/SMS notifications provider** for alerts (currently in-app + logged only).
6. **River Mobile API clients**: issue prod API keys (`API_KEY_PEPPER_PROD` secret) to River Mobile.
7. **Routing server**: if turn-by-turn is needed, River's own OSRM; the shop app does not route (`routingUrl={null}`).
8. **Budgets/alerts** on the project (Cloud Run, Firestore, Storage egress) and Firestore **backups / PITR** on `mycarwash-prod`.
9. Optional: App Check (reCAPTCHA Enterprise) for the web app.
