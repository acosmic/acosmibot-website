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

Plain settings console: a sticky summary and jump index sit beside one grouped list of switches, making privacy dependencies and server-specific visibility easy to scan. The page answers three questions in order: who can see me, what do they see, and how does Acosmibot reach me.

## Copy

This is a utility surface, so copy is literal. Headings, labels, and hints name the thing and say what happens when a switch is on or off; no "signal", "routing", "dossier", or "control plane" metaphors. Every switch reads the same way: on means shared or active. When the profile page is private, the profile-content groups say so instead of silently having no effect.

## Constraints

Preserve owner redirects, privacy PATCH semantics, public-profile dependency rules, per-guild visibility, timezone behavior, achievement DM preference, Spotify presence opt-out, accessible native controls, and honest mutation states. Do not imply a Spotify OAuth connection that the product does not provide.

## Unresolved decisions

Spotify account linking remains intentionally deferred; the surface explains presence-based tracking instead.
