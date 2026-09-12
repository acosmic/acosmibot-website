# Container runtime

This image is an isolated test/staging harness and portability proof. The
production website continues to build and deploy as an Azure Static Web App;
production DNS and traffic must continue using that SWA deployment. The image
packages the built SPA and local adapter contracts so the test environment can
exercise them together.

## One image, one process

The canonical `Dockerfile` starts one non-root Node process on TCP port `8080`
(`runtime/server.mjs`, under `tini`). It serves `dist` and owns these adapter
paths in the same image:

- `POST /api/render-card` — bundled Azure SWA function.
- `GET /api/status` — bundled status relay function.
- crawler `GET /u/<identifier>` — bundled Cloudflare profile-unfurl worker;
  human requests receive the SPA shell.
- `GET /embed-images/*` — bundled Cloudflare CDN blob-proxy worker.

The normal application API remains an independently configured service through
`API_BASE_URL`; this harness does not replace that API. Set `ACOSMIBOT_ENVIRONMENT`
to `test` (the image default) or `staging` for the isolated harness. Both values
fail closed when a backend or origin has not been explicitly configured.

`server.mjs` serves the Vite output and keeps the two existing edge contracts
available in a Node-hosted rehearsal:

- `POST /api/render-card` invokes the Azure SWA render-card function bundle.
- `GET /api/status` invokes the public status relay bundle.
- crawler requests for `/u/<identifier>` use the Cloudflare profile-unfurl
  handler; human requests receive the SPA shell.
- `/embed-images/*` uses the Cloudflare CDN blob proxy handler.
- `/healthz` (and `/health`) reports readiness only after `dist/index.html` and
  both bundled Azure function modules load successfully.

The container accepts these settings. `ACOSMIBOT_ENVIRONMENT=test` or `staging`
is fail-closed: it does not synthesize production API, origin, invite, payment,
analytics, status, render-card, or CDN values. In the one-image harness,
browser status and render-card calls default to the local `/api/*` adapters and
the browser CDN base defaults to the container origin; the profile and CDN
workers still require their explicitly configured upstreams before they proxy.

| Variable | Browser setting | Production default |
| --- | --- | --- |
| `SITE_ORIGIN` | `siteOrigin` | `https://acosmibot.com` |
| `API_BASE_URL` | `apiBaseUrl` | `https://api.acosmibot.com` |
| `ORIGIN_BASE_URL` | `originBaseUrl` | `https://acosmibot.com` |
| `INVITE_URL` | `inviteUrl` | Discord bot authorization URL |
| `PAYMENT_URL` | `paymentUrl` | Stripe donation link |
| `ANALYTICS_MEASUREMENT_ID` | — | production GA4 property |
| `STATUS_URL` | `statusUrl` | `/api/status` |
| `RENDER_CARD_URL` | `renderCardUrl` | API render-card endpoint |
| `CDN_BASE_URL` | `cdnBaseUrl` | `https://cdn.acosmibot.com` |
| `CDN_BLOB_ORIGIN` | — | required for a test CDN proxy |
| `STATUS_API_HEALTH_URL` | — | API health probe for the status relay |
| `SENTRY_STATUS_ORIGIN` | — | Sentry API origin for status telemetry |
| `RENDER_SHARED_SECRET` | — | required by render-card |

The static runtime adds SWA-equivalent security headers. Test and staging HTML
responses additionally receive `X-Robots-Tag: noindex, nofollow`, rewritten
robots metadata, and a deny-all `robots.txt` response.
