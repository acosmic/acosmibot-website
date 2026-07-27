---
version: 1
slug: "src-pages-profilepage-tsx"
primary_target: "src/pages/ProfilePage.tsx"
related_targets: ["src/styles/member.css","src/components/profile/MemberNav.tsx","src/components/profile/TrophyCase.tsx","src/components/profile/InventorySection.tsx","src/components/profile/DailyReward.tsx","src/components/profile/NotificationList.tsx"]
---

## Scope and mode

Public member route (`/u/:identifier`) with owner enhancements, Read.

## Audience, job, and action

Community members and visitors reading a member’s identity, global standing, activity, visible server coordinates, and earned achievements. Owners also need direct access to rewards, inventory, daily claims, and member tools.

## Proof and content

The real rendered rank card, permission-gated profile response, global metrics, command and reaction traces, visible guilds, achievements, notifications, inventory, and daily state are the proof.

## Direction and memorable moment

Member Dossier: the live rank card and a concise signal ledger establish identity before progressively revealing community coordinates and collected milestones.

## Constraints

Preserve public and owner query behavior, privacy masking, signed-out access rules, unavailable-profile handling, notification actions, inventory/equipment, daily claims, owner shortcuts, responsive reading order, keyboard access, and reduced motion.

## Unresolved decisions

The existing `/profile` legacy redirect remains the owner entry point; the canonical presentation stays under `/u/:identifier`.
