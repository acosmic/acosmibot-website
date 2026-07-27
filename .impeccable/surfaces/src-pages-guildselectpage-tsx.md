---
version: 1
slug: "src-pages-guildselectpage-tsx"
primary_target: "src/pages/GuildSelectPage.tsx"
related_targets: ["src/styles/servers.css"]
---

## Scope and mode

Signed-in server selection route (`/servers`), Operate.

## Audience, job, and action

Discord community owners, administrators, and members choosing where to continue. They should distinguish configuration access from participation at a glance, then open management or the relevant public leaderboard.

## Proof and content

The authenticated guild response is the proof: live guild identity, owner or administrator permissions, membership, premium tier, and member count. Empty, loading, error, search, and invite states must remain literal and useful.

## Direction and memorable moment

Permission-Aware Constellation Catalog: the Acosmibot core anchors an access orbit, while the catalog below divides destinations into configuration and community bands before presenting server nodes.

## Constraints

Preserve authentication redirects, guild fetching, selected-guild store behavior, manage and leaderboard routes, Discord invite behavior, responsive usability, keyboard access, reduced motion, and honest state handling.

## Unresolved decisions

Search remains local to the authenticated guild list; server-side discovery is outside this scope.
