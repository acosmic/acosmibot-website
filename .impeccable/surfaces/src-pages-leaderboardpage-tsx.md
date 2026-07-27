---
version: 1
slug: "src-pages-leaderboardpage-tsx"
primary_target: "src/pages/LeaderboardPage.tsx"
related_targets: ["src/styles/leaderboard.css"]
---

## Scope and mode

Global and guild leaderboard routes (`/leaderboard` and `/leaderboard/:guildId`), Read.

## Audience, job, and action

Discord community members comparing their global XP, net worth, or server level against the field. They should recognize the leaders immediately, scan deeper ranks efficiently, switch ranking contexts, and open eligible public profiles.

## Proof and content

Live API-ranked entries are the proof: global XP, global economy, guild level and XP, current-user state, privacy masking, and guild membership enforcement. Never substitute illustrative rankings for live data.

## Direction and memorable moment

Signal Array: the first three live entries become distinct beacons along one connected ascent path, while ranks four onward form a compact field ledger. The current viewer appears as a selected signal rather than a separate dashboard metric.

## Constraints

Preserve React Query behavior, 50-entry expansion, global metric switching, authenticated guild selection, profile links, relationship-based masking, blurred masked avatars, guild login and 403 states, public navigation, footer links, keyboard access, and reduced motion.

## Unresolved decisions

The existing incremental “Load more” model remains; cursor pagination or rank search can be considered separately.
