---
version: 1
slug: "src-components-layout-dashboardshell-tsx"
primary_target: "src/components/layout/DashboardShell.tsx"
related_targets: ["src/styles/dashboard.css","src/components/layout/Sidebar.tsx","src/components/layout/ServerContextBar.tsx","src/components/ui/FeatureToggle.tsx","src/components/ui/CollapsibleSection.tsx","src/components/ui/SaveBar.tsx","src/components/ui/SocialAlertsLayout.tsx","src/features/overview/OverviewPage.tsx","src/features/moderation/ModerationPage.tsx","src/features/custom-commands/CustomCommandsPage.tsx","src/features/analytics/GuildAnalyticsPage.tsx","src/features/activity-monitor/ActivityMonitorPage.tsx","src/features/better-embeds/BetterEmbedsPage.tsx","src/features/billing/BillingPage.tsx","src/features/embeds/EmbedBuilderPage.tsx","src/features/embeds/EmbedsListPage.tsx","src/features/games/GamesPage.tsx","src/features/giveaway/GiveawayPage.tsx","src/features/music/MusicPage.tsx","src/features/polymorph/PolymorphPage.tsx","src/features/reaction-roles/ReactionRoleBuilderPage.tsx","src/features/reaction-roles/ReactionRolesListPage.tsx","src/features/streaming/StreamPlatformFeature.tsx","src/features/x-alerts/XAlertsPage.tsx"]
---

## Scope and mode

Authenticated guild administration routes (`/server/:guildId/*`), Operate.

## Audience, job, and action

Discord server owners and administrators configuring Acosmibot for one community. They should confirm the active server and permission scope, choose a subsystem from a stable map, understand its live state, edit focused controls, and deliberately commit changes to Discord.

## Proof and content

The authenticated guild response, owner or administrator permission, current hybrid configuration, live channels and roles, subscription tier, subsystem records, dirty state, save result, and API errors are the proof. The shell covers the overview, billing, leveling, analytics, music, embeds, reaction roles, activity monitoring, custom commands, moderation, banned users, AI, streaming alerts, chaos tools, games, giveaways, and honest coming-soon states.

## Direction and memorable moment

Server Control Matrix: a compact guild-coordinate rail and grouped subsystem rail remain fixed around one focused observatory workspace. A persistent context bar names the server and current system; cyan routing signals expose selection, live state, and the explicit save boundary. Overview reads as server identity and subscription, personal KPIs, one combined activity-and-growth surface, then unboxed resource exits. Configuration pages follow scope → current state → grouped controls or records → save. One workflow ledger owns the outer perimeter, its sections use dividers, saved records share ledger rows, and simple explanatory or single-purpose groups remain open sections. Social alert routes use one operational pattern: plan telemetry, one tracked-account roster, literal active/ready/paused state, an inline pause switch, a compact action group, and one Discord-route panel.

## Constraints

Preserve OAuth authentication, selected-guild store behavior, server-side permission enforcement, management gating, existing route compatibility, TanStack query and mutation behavior, premium limits, real channels and roles, dirty-state guards, save and discard behavior, builder previews, loading and error states, keyboard access, responsive drawer behavior, and reduced motion. Complete borders are reserved for independent responsibilities; repeated metrics use a segmented perimeter, subordinate field groups use tonal separation, and records use one shared ledger boundary. Social-alert records stay inside one roster perimeter and must expose their delivery state in text as well as color; pausing keeps the record and its overrides saved. Preview artifacts, selectable game or plan choices, dialogs, and independently actionable summaries may keep their own perimeter.

## Unresolved decisions

Coming-soon Jail, Lottery, and Portals remain visible in their existing groups without implying live configuration. Route-level deep linking is preserved; no feature information architecture or API payload is renamed in this redesign.
