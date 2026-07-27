---
version: 1
slug: "src-pages-premiumpage-tsx"
primary_target: "src/pages/PremiumPage.tsx"
related_targets: ["src/styles/pricing.css"]
---

## Scope and mode

Pricing page (`/pricing`), Persuade.

## Audience, job, and action

Discord server owners comparing Acosmibot capacity and AI access. They should understand the shared free core, identify the tier that removes their current limit, choose monthly or annual billing, and select an eligible server.

## Proof and content

The four-tier trajectory is the comparison proof: Free establishes the core, Plus raises creator and utility limits, Pro activates the complete AI layer, and Max raises AI usage. Prices, limits, checkout status, and per-server billing must stay aligned with live product sources.

## Direction and memorable moment

Plan Orbit: the homepage constellation becomes a pricing instrument. The first viewport places the offer beside four stations orbiting the Acosmibot core; the comparison continues as a connected trajectory with tier-specific signal colors and one shared billing control.

## Constraints

Preserve Stripe checkout, Discord authentication, guild preselection, monthly/annual switching, billing kill-switch behavior, server selection and management, responsive comparison, keyboard focus, and reduced motion.

## Unresolved decisions

Checkout remains visibly marked as coming soon whenever the API billing flag is disabled.
