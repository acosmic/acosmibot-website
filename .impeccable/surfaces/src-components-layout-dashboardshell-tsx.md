---
version: 1
slug: "src-components-layout-dashboardshell-tsx"
primary_target: "src/components/layout/DashboardShell.tsx"
related_targets: ["src/styles/dashboard.css","src/components/layout/Sidebar.tsx","src/components/layout/ServerContextBar.tsx","src/components/ui/FeatureToggle.tsx","src/components/ui/CollapsibleSection.tsx","src/components/ui/SaveBar.tsx","src/features/overview/OverviewPage.tsx","src/features/analytics/GuildAnalyticsPage.tsx","src/features/embeds/EmbedBuilderPage.tsx","src/features/reaction-roles/ReactionRoleBuilderPage.tsx"]
---

## Scope and mode

Authenticated guild administration routes (`/server/:guildId/*`), Operate.

## Audience, job, and action

Discord server owners and administrators configuring Acosmibot for one community. They should confirm the active server and permission scope, choose a subsystem from a stable map, understand its live state, edit focused controls, and deliberately commit changes to Discord.

## Proof and content

The authenticated guild response, owner or administrator permission, current hybrid configuration, live channels and roles, subscription tier, subsystem records, dirty state, save result, and API errors are the proof. The shell covers the overview, billing, leveling, analytics, music, embeds, reaction roles, activity monitoring, custom commands, moderation, banned users, AI, streaming alerts, chaos tools, games, giveaways, and honest coming-soon states.

## Direction and memorable moment

Server Control Matrix: a compact guild-coordinate rail and grouped subsystem rail remain fixed around one focused observatory workspace. A persistent context bar names the server and current system; cyan routing signals expose selection, live state, and the explicit save boundary.

## Constraints

Preserve OAuth authentication, selected-guild store behavior, server-side permission enforcement, management gating, existing route compatibility, TanStack query and mutation behavior, premium limits, real channels and roles, dirty-state guards, save and discard behavior, builder previews, loading and error states, keyboard access, responsive drawer behavior, and reduced motion.

## Unresolved decisions

Coming-soon Jail, Lottery, and Portals remain visible in their existing groups without implying live configuration. Route-level deep linking is preserved; no feature information architecture or API payload is renamed in this redesign.
