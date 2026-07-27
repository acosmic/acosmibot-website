# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Discord community owners and administrators evaluating, configuring, and operating Acosmibot for their servers. Community members also use the public profile, leaderboard, achievement, and documentation surfaces.

## Product Purpose

Acosmibot helps Discord communities stay active and well-run by connecting engagement, AI, leveling, economy, games, streaming alerts, moderation, and server utilities in one bot and web dashboard.

## Positioning

The product is a connected community system rather than a collection of isolated commands: member activity can flow through shared leveling, economy, inventory, games, social, and administration features.

## Operating Context

Visitors first evaluate the bot on the public website, add it to Discord through OAuth, then authenticate with Discord to configure servers and use account-scoped features in the dashboard.

## Capabilities and Constraints

- The public homepage must keep Add to Discord as its primary action.
- Discord login, existing public navigation destinations, support/donation actions, and legal links must remain available.
- Product claims must reflect implemented capabilities; the site has no supplied customer logos, testimonials, or benchmark data to fabricate as proof.
- The website is a React 18 and TypeScript SPA built with Vite.

## Brand Commitments

- Product name: Acosmibot.
- Existing Acosmibot logo and Signal Cyan identity.
- The homepage should translate the Acosmibot knowledge-graph visualization into the marketing website, presenting the product as a connected constellation.

## Evidence on Hand

- Product copy and feature inventory in `src/pages/HomePage.tsx`.
- Public navigation and authenticated account behavior in `src/components/layout/PublicNav.tsx`.
- Brand assets in `public/images/`.
- The visual reference is `../acosmibot-knowledge/visualizer/template.html`.

## Product Principles

- Make the relationship between features visible, not merely claim that they are connected.
- Keep community-owner actions obvious even when the presentation is expressive.
- Prefer truthful product demonstrations over generic marketing proof.
- Preserve a clear path from evaluation to adding and configuring the bot.

