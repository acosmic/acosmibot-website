---
version: 1
slug: "src-pages-achievementspage-tsx"
primary_target: "src/pages/AchievementsPage.tsx"
related_targets: ["src/styles/member.css","src/components/profile/MemberNav.tsx"]
---

## Scope and mode

Signed-in achievements route (`/achievements`), Operate.

## Audience, job, and action

Members tracking earned badges and deciding what to pursue next. They should understand total completion, scan categories, distinguish unlocked from in-progress achievements, and identify claimable rewards or limited-time opportunities.

## Proof and content

The live achievement catalog is the proof: category, tier, unlock state, progress thresholds, credit and cosmetic rewards, and availability windows. Signed-out, loading, error, empty, and retry states remain explicit.

## Direction and memorable moment

Progression Atlas: one completion orbit introduces category sectors that read as connected achievement signals rather than a generic card gallery.

## Constraints

Preserve authenticated fetching, real catalog grouping, secret-safe content, reward metadata, limited-time state, progress math, signed-out gating, responsive usability, keyboard access, and reduced motion.

## Unresolved decisions

Achievement detail expansion remains a future enhancement; this pass keeps each atlas node self-contained.
