---
version: 1
slug: "src-pages-cardstudiopage-tsx"
primary_target: "src/pages/CardStudioPage.tsx"
related_targets: ["src/styles/member.css","src/components/profile/MemberNav.tsx"]
---

## Scope and mode

Owner-only rank-card cosmetics route (`/card-studio`), Operate.

## Audience, job, and action

Members previewing, equipping, and purchasing rank-card materials. They should keep the effect on their real card visible while comparing accent, background, and avatar-ring options.

## Proof and content

The authenticated profile, live rank-card render, cosmetic catalog, ownership and equipped state, bank balance, achievement locks, prices, and active shop discount are the proof.

## Direction and memorable moment

Sticky-Preview Workbench: the real rank card remains the visual anchor while material trays provide direct try-on, equip, and purchase controls.

## Constraints

Preserve authentication redirects, catalog fetching, local try-on, immediate owned-item equip, purchase confirmation, price discounts, insufficient-funds and achievement-lock states, mutation refreshes, keyboard-safe dialog behavior, responsive order, and reduced motion.

## Unresolved decisions

The preview is intentionally local until equip or purchase succeeds; no draft loadout is persisted.
