---
version: 1
slug: "src-components-layout-publicnav-tsx"
primary_target: "src/components/layout/PublicNav.tsx"
related_targets: ["src/styles/public-nav.css","src/components/profile/NotificationBell.tsx"]
---

## Scope and mode

Shared persistent navigation across public, member, admin, and server-selection SPA routes. It bridges Persuade marketing surfaces and Operate account surfaces without becoming a full dashboard shell.

## Audience, job, and action

Visitors, authenticated members, and the super-admin use the bar to orient themselves, move between product and account destinations, review notification state, open their identity controls, and sign in or out. On mobile, the drawer must expose the same meaningful route families without conflating profile navigation with logout.

## Proof and content

The current route, hydrated Discord identity, avatar, global name and username, authentication state, unread-notification count, and super-admin role are the proof. Navigation includes Features, Pricing, Documentation, Leaderboards, public Status, Servers, Profile, Achievements, Settings, Admin when authorized, and an explicit logout action.

## Direction and memorable moment

Site Coordinates Relay: the desktop account panel and mobile drawer behave like compact observatory instruments. Grouped mono labels, Lucide subsystem glyphs, cyan route nodes, an explicit connected-state light, and opaque field panels make the shared navigation feel native to the graph redesign rather than like a generic menu.

## Constraints

Preserve OAuth hydration, existing route and anchor destinations, admin visibility rules, notifications, outside-click and Escape dismissal, route-change closure, mobile body scroll locking, keyboard focus visibility, responsive overflow, reduced motion, and readable identity truncation. Use native links and buttons; account navigation and logout must remain distinct actions.

## Unresolved decisions

Terms of Service, Privacy Policy, and the 404 route still need full-page observatory redesigns, but they already inherit this shared navigation treatment. Callback and redirect-only routes remain intentionally undesigned.
