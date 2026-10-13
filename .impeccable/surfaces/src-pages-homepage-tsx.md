---
version: 1
slug: "src-pages-homepage-tsx"
primary_target: "src/pages/HomePage.tsx"
related_targets: ["src/styles/home.css","src/components/home/DiscordShowcase.tsx","src/styles/home-showcase.css"]
---

## Scope and mode

Homepage (`/`), Persuade.

## Audience, job, and action

Discord community owners evaluating whether Acosmibot can make their server more active and manageable. They should understand the connected breadth of the product, explore relevant capabilities, then use Add to Discord.

## Proof and content

The interactive fifteen-node product topology is the proof. It presents Chaos as the parent system for Portals, Polymorph, and Jail, while keeping Utilities, Reaction Roles, Better Embeds, Activity Monitoring, and Analytics at the primary feature tier. It exposes implemented descriptions and capability lists without invented customers, benchmarks, or testimonials.

The "Acosmibot in action" showcase comes directly after the hero and before the system topology, so visitors see real output before the feature map. Its header is the eyebrow and that one title, with no explanatory paragraph. Each feature has its own row, alternating sides down the page: the explanation sits on one side and a Discord channel panel sits on the other, tilted toward the page center; the mirrored rows flip the tilt, shadows, and lit edge. There is no click-through picker for the section and no decorative mascot sticker on the panels.

The rows are Rank Cards, AI Chat, Games, Custom Embeds, Better Social Embeds, and Event Horizon. Custom Embeds is the dashboard builder; Better Social Embeds is the automatic social-link preview. They are separate features and must not be merged under "Better Embeds". Rank Cards cycles real Card Studio backgrounds (catalog gradients, ring and accent values, and copies of the uploaded artwork). AI Chat cycles weather, server stats, web search, reminders, image generation, and emote creation. Games cycles Slots, Keno, Blackjack, Rock Paper Scissors, Deathroll, and Heist. The carousels advance on their own only while on screen, stop for reduced-motion visitors, and keep a pause control plus one chip per slide. The Better Social Embeds preview plays a muted looping clip under the same rules. Event Horizon sits directly under it and shows the Activity rather than a channel: a muted loop of a real ranked flight (cropped from the owner's own recording, with the webcam and captions left out) beside the lobby's leaderboard card, set in the Activity's Chakra Petch face. Its standings are sample members; its facts (5× orbit multiplier, the hazard phases, leaderboards, spectating, record posts, free on every plan) come from the Event Horizon guide.

The system topology follows the showcase. Its links are meaningful: every feature links to the core, and feature-to-feature links exist only for relationships the product really has, each with a short label for what moves across it. Selecting a node lights its links, shows those labels on the map, marks the related nodes, and sends signal pulses out from the core. The links draw outward and the nodes arrive in order the first time the map scrolls into view. Left alone, the map tours itself node by node; any selection by the visitor ends the tour, hovering the inspector holds it, and a header control pauses or resumes it. The mascot stands at the core, matching the hero. The inspector shows a compact live example for every feature, plus "Works with" chips that jump to related nodes; a feature without an example would fall back to its capability checklist. Fourteen examples are Discord output (go-live alert, shop list, giveaway, moderation log, role menu, custom command, the member list grouped by activity roles, Polymorph and a Jail vote, and the showcase scenes). Server Analytics instead shows the dashboard's Server activity panel with the real member-growth chart component, labelled "In the dashboard". The example takes whatever height the inspector has left and fades out past it, so on wide screens the explorer keeps one height for every node and the tour never moves the page. A link label that would cover a node or the mascot is pinned to a clear stretch of its link.

Rank and weather use the same card components the render-card function rasterizes for Discord, the announcement uses the dashboard embed preview, and each game result mirrors the embed the bot builds. Members, servers, and values are sample data; layout, art, and wording must stay true to what the bot sends. The showcase panels carry no "Example · sample data" label (owner decision); the inspector keeps a small "Sample data" tag beside its example. The Darkn1de artwork is not used as a rank-card example anywhere on the page (owner decision).

## Direction and memorable moment

Community Constellation: a living observatory adapted from the Acosmibot knowledge graph. The first viewport places the offer beside an orbiting product system with the Acosmibot mascot floating over the core, larger than the ring so it breaks past the orbit lines; the second fold turns every feature into a selectable graph node with an adjacent inspector.

## Constraints

Preserve Discord OAuth actions, public navigation, all existing feature content, support/donation actions, legal links, responsive usability, keyboard access, and reduced-motion behavior.

## Unresolved decisions

This homepage is the design prototype for potentially carrying the constellation language into other public website surfaces; those surfaces are not changed in this scope.
