---
version: 1
slug: "src-pages-docs-docspage-tsx"
primary_target: "src/pages/docs/DocsPage.tsx"
related_targets: ["src/styles/docs.css"]
---

## Scope and mode

Documentation routes (`/docs/*`), Read.

## Audience, job, and action

Discord community owners, moderators, and members learning how to configure or use Acosmibot. They should find the right system quickly, understand one article without visual distraction, and move to the next relevant task or command.

## Proof and content

The existing documentation articles, command signatures, setup steps, plan tables, feature links, and operational notes are the proof. Preserve every article route and its current HTML content while improving shell-level wayfinding and readability.

## Direction and memorable moment

Observatory Field Manual: a compact constellation index on the left, an illuminated reading stage in the center, and a live section-signal rail on wide screens. The shell feels connected to the homepage and pricing observatory, but content surfaces stay calm, opaque, and optimized for long-form reading.

## Constraints

Preserve static article loading, `window.DocsRouter` navigation, search filtering, public navigation, keyboard access, responsive drawer behavior, external links, reduced motion, and long tables. Do not invent usage data or rewrite documentation facts.

## Unresolved decisions

Search remains a title/topic filter in this scope; full-text indexing can be considered separately.
