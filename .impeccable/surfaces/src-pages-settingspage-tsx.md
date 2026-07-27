---
version: 1
slug: "src-pages-settingspage-tsx"
primary_target: "src/pages/SettingsPage.tsx"
related_targets: ["src/styles/member.css","src/components/profile/MemberNav.tsx","src/components/profile/OwnerSettings.tsx","src/components/profile/ConnectedAccountsSettings.tsx"]
---

## Scope and mode

Owner-only member settings route (`/settings`), Operate.

## Audience, job, and action

The signed-in member controlling what their public profile reveals, which servers appear, how achievement notices arrive, their timezone, and whether listening activity is retained.

## Proof and content

The authenticated profile privacy model, visible guild list, timezone, and Spotify presence status are the proof. Every toggle and timezone action reflects a real mutation with saving, success, retry, and failure feedback.

## Direction and memorable moment

Signal-Routing Board: a compact owner identity scope sits beside one grouped control plane, making privacy dependencies and server-specific visibility easier to scan.

## Constraints

Preserve owner redirects, privacy PATCH semantics, public-profile dependency rules, per-guild visibility, timezone behavior, achievement DM preference, Spotify presence opt-out, accessible native controls, and honest mutation states. Do not imply a Spotify OAuth connection that the product does not provide.

## Unresolved decisions

Spotify account linking remains intentionally deferred; the surface explains presence-based tracking instead.
