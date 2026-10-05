# Custom domain: mycarwash.ph on App Hosting

Mycarwash.ph is served by Firebase App Hosting backends:

| Environment | Backend ID | Default URL |
|---|---|---|
| Dev | `mycarwash-dev` | https://mycarwash-dev--mycarwashph.asia-southeast1.hosted.app |
| Prod | `mycarwash-prod` | https://mycarwash-prod--mycarwashph.asia-southeast1.hosted.app |

## Attach `mycarwash.ph` (prod)

1. Open [App Hosting](https://console.firebase.google.com/project/mycarwashph/apphosting) → backend **mycarwash-prod** → **Custom domains**.
2. Add `mycarwash.ph` and `www.mycarwash.ph`.
3. Create the DNS records Firebase shows (usually A/AAAA or CNAME) at your registrar. **DNS is your job** — the box cannot change your domain registrar.
4. Wait for SSL provisioning (often minutes to a few hours).
5. In [Authorized domains](https://console.firebase.google.com/project/mycarwashph/authentication/settings) add `mycarwash.ph` and `www.mycarwash.ph` (required for Auth).
6. Confirm `frontend/apphosting.prod.yaml` / CORS origins already list those hosts (they do in `ENVIRONMENTS.prod.allowedOrigins`).

## River Mobile partner API URL

Under the org Domain restricted sharing policy, Cloud Functions stay private. Use the same-origin App Hosting proxy:

- Shop API: `https://mycarwash.ph/api/...` (or the hosted.app URL)
- Partner `/v1`: `https://mycarwash.ph/v1/...` (or `https://api.mycarwash.ph/v1/...` once that hostname also points at the prod App Hosting backend)

Do **not** grant `allUsers` `roles/run.invoker` on the function services.
