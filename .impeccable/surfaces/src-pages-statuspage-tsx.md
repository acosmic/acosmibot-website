---
version: 1
slug: "src-pages-statuspage-tsx"
primary_target: "src/pages/StatusPage.tsx"
related_targets: ["src/styles/status.css","src/api/status.ts","api/status/index.ts"]
---

## Scope and mode

Public `/status` route in Read mode. It is the independent service-health and incident-transparency surface, hosted with the Azure website rather than the home-server API it observes.

## Audience, job, and action

Members, community owners, and the operator need to learn whether Acosmibot is currently usable, which service boundary is affected, how fresh the evidence is, and what happened in a prior incident. The only action is an explicit refresh; support remains available through the shared footer.

## Proof and content

An Azure-side live API probe, Sentry Uptime state and 30-day checks, the bot/database Cron heartbeat, a freshness timestamp, and a curated incident ledger provide the proof. Missing monitoring data is labeled unavailable and never replaced with illustrative values.

## Direction and memorable moment

Flight Recorder: one large literal status declaration sits beside a 30-day availability track, followed by a connected Website → API → Bot/Database relay and an incident ledger. The orbiting beacon is the single authored motion moment; semantic status colors remain literal.

## Constraints

The page must remain reachable when the home server is down. Sentry credentials stay in Azure settings, and the browser receives no logs, issue text, stack traces, raw identifiers, project IDs, or infrastructure secrets. Preserve 44px controls, reduced motion, local-time incident dates, responsive stacking, search metadata, and explicit delayed/partial states.

## Unresolved decisions

The Sentry read-only token and Azure app setting must be connected before live Cron history appears. Future incidents remain curated unless a separate sanitized incident-publishing workflow is approved.
