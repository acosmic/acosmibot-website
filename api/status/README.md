# Public status relay

`GET /api/status` is the only public observability boundary. It checks the
production API from Azure and, when configured, reads Sentry Uptime and Cron
health server-side. The response is a fixed, sanitized schema; raw Sentry data
is never proxied to the browser.

Configure these Azure Static Web Apps application settings:

| Setting | Required | Default |
| --- | --- | --- |
| `SENTRY_STATUS_TOKEN` | For Sentry data | — |
| `SENTRY_STATUS_ORG` | No | `acosmic` |
| `SENTRY_STATUS_API_PROJECT` | No | `acosmibot-api` |
| `SENTRY_STATUS_UPTIME_NAME` | No | `Acosmibot API uptime` |
| `SENTRY_STATUS_UPTIME_DETECTOR_ID` | No | Discovered by exact monitor name |
| `SENTRY_STATUS_BOT_MONITOR` | No | `acosmibot-bot-db` |

Use a dedicated Sentry internal-integration token with read-only organization,
project, and alert access. Never use a DSN here: DSNs ingest events and cannot
read monitor state. Without the token, the endpoint remains useful as a direct
off-host API probe but reports Sentry history and bot/database health as
unavailable.

The function caches successful payloads for 30 seconds and may serve stale data
for up to five minutes during an upstream monitoring failure.
