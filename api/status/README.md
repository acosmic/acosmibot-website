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
| `SENTRY_STATUS_WEBSITE_PROJECT` | No | `acosmibot-api` |
| `SENTRY_STATUS_WEBSITE_UPTIME_NAME` | No | `Acosmibot website uptime` |
| `SENTRY_STATUS_WEBSITE_DETECTOR_ID` | No | Discovered by exact monitor name |

Use a dedicated Sentry internal-integration token with read-only organization,
project, and alert access. Never use a DSN here: DSNs ingest events and cannot
read monitor state. Without the token, the endpoint remains useful as a direct
off-host API probe but reports Sentry history and bot/database health as
unavailable.

The function caches successful payloads for 30 seconds and may serve stale data
for up to five minutes during an upstream monitoring failure.

## Availability history

Each component has its own `history` with 30 UTC calendar days, including
today so far. The legacy top-level `uptime` remains an API-history alias.
Sentry uptime history requires Unix-second `since`/`until` and
`resolution=1d`; `statsPeriod` and `interval` are silently ignored by that
endpoint. Bot history uses the aggregate `monitors-stats` endpoint, a fixed
monitor ID, and `environment=production`; the older per-monitor stats endpoint
timed out during the 30-day rehearsal.

Daily bars are green with zero recorded downtime, yellow with more than zero
but less than 60 minutes, red at 60 minutes or more, and gray without health
evidence. HTTP downtime includes only Sentry `failure_incident` checks;
isolated `failure` and `missed_window` counts remain visible in tooltips.
Bot downtime includes `error`, `timeout`, and grace-expired `missed` heartbeats;
`unknown` and `in_progress` do not prove an outage. This monitor has a one-minute
cron schedule; a different schedule fails closed until its cadence is handled.

Downtime is an estimate from the recorded check count and configured monitor
interval, not a second-accurate incident duration. Percentages use confirmed
downtime check counts over recorded checks, consistently for daily and period
totals. Entire buckets without health evidence do not improve percentages.
The color rule does not change live status or Sentry alert thresholds.

The API and website have independent fixed-URL live probes. Website history
requires its own Sentry uptime monitor for `https://acosmibot.com/`, ideally
at one-minute cadence with response capture and tracing disabled, matching the
privacy boundary of the API monitor. This relay never creates monitors or
changes monitoring settings. Until configured, the website has no historical
percentage or colored history; API/bot history is never used as a substitute.
