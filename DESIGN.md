---
name: Acosmibot
description: A confident, energetic command deck for running and growing Discord communities.
colors:
  signal-cyan: "#00D9FF"
  signal-cyan-bright: "#00F0FF"
  signal-cyan-deep: "#00A0CC"
  constellation-cyan-bright: "#67ECFF"
  constellation-violet: "#9F8BFF"
  constellation-coral: "#FF8F72"
  constellation-green: "#4FE3A1"
  observatory-void: "#05080D"
  observatory-space: "#08111A"
  observatory-panel: "#0D151D"
  observatory-node: "#15212B"
  observatory-raised: "#111C26"
  observatory-hover: "#13212C"
  constellation-white: "#F4FBFF"
  constellation-text: "#A9BAC7"
  constellation-muted: "#71808D"
  constellation-muted-bright: "#8293A0"
  observatory-backdrop: "rgba(0, 0, 0, 0.68)"
  control-black: "#1A1A1A"
  control-graphite: "#2A2A2A"
  control-panel: "#2D2D2D"
  control-raised: "#333333"
  control-hover: "#3A3A3A"
  control-overlay: "rgba(0, 217, 255, 0.08)"
  control-overlay-hover: "rgba(0, 217, 255, 0.15)"
  polar-white: "#FFFFFF"
  cool-gray: "#B0B0B0"
  muted-gray: "#808080"
  border-subtle: "rgba(255, 255, 255, 0.1)"
  border-strong: "rgba(255, 255, 255, 0.2)"
  border-signal: "rgba(0, 217, 255, 0.4)"
  success: "#00FF88"
  error: "#FF4444"
  warning: "#FFB800"
typography:
  display:
    fontFamily: "Poppins, sans-serif"
    fontSize: "clamp(3rem, 6vw, 5rem)"
    fontWeight: 800
    lineHeight: 1.1
  headline:
    fontFamily: "Poppins, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.2
  page:
    fontFamily: "Poppins, sans-serif"
    fontSize: "36px"
    fontWeight: 750
    lineHeight: 1.15
  pageCompact:
    fontFamily: "Poppins, sans-serif"
    fontSize: "30px"
    fontWeight: 750
    lineHeight: 1.15
  section:
    fontFamily: "Poppins, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.35
  title:
    fontFamily: "Poppins, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Poppins, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  bodyLarge:
    fontFamily: "Poppins, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  dense:
    fontFamily: "Poppins, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
  avatarInitial:
    fontFamily: "Poppins, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1
  label:
    fontFamily: "Poppins, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.5px"
  caption:
    fontFamily: "Poppins, sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.4
  telemetry:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "9px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
  micro:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "8px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
  compact:
    fontFamily: "Poppins, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  xs: "3px"
  sm: "4px"
  instrument: "6px"
  instrument-lg: "7px"
  md: "8px"
  action: "9px"
  menu: "10px"
  node-tile: "11px"
  lg: "12px"
  operational: "13px"
  mobile-panel: "14px"
  card: "15px"
  xl: "16px"
  modal: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  "2xl": "24px"
  "3xl": "32px"
  "4xl": "40px"
components:
  button-primary:
    backgroundColor: "{colors.signal-cyan}"
    textColor: "{colors.control-black}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.signal-cyan-bright}"
    textColor: "{colors.control-black}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.control-raised}"
    textColor: "{colors.polar-white}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "44px"
  input:
    backgroundColor: "{colors.control-raised}"
    textColor: "{colors.polar-white}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.control-panel}"
    textColor: "{colors.polar-white}"
    rounded: "{rounded.card}"
    padding: "24px"
  card-hover:
    backgroundColor: "{colors.control-hover}"
    textColor: "{colors.polar-white}"
    rounded: "{rounded.card}"
    padding: "24px"
  nav-item-active:
    backgroundColor: "{colors.control-overlay-hover}"
    textColor: "{colors.polar-white}"
    typography: "{typography.body}"
    padding: "10px 20px"
    height: "44px"
  status-chip-active:
    backgroundColor: "rgba(0, 255, 136, 0.15)"
    textColor: "{colors.success}"
    typography: "{typography.label}"
    rounded: "6px"
    padding: "4px 10px"
---

# Design System: Acosmibot

## Overview

**Creative North Star: "Cyan Command Deck"**

Acosmibot feels like a live command deck for a busy Discord community: dark, focused, and operational, with Signal Cyan marking the controls and information that deserve attention. The interface is confident, technical, and energetic without becoming noisy. Deep graphite layers create a stable working environment; crisp type, compact labels, and responsive feedback keep dense configuration screens easy to scan.

The system is tactile and confident. Panels separate responsibilities, controls react with short lifts or cyan focus, and the brightest color remains a deliberate signal rather than ambient decoration. Marketing surfaces may increase scale and curvature, while the dashboard stays compact and task-first. Avoid generic enterprise SaaS neutrality: Acosmibot should retain its unmistakable cyan-on-graphite identity and community-tool energy.

**Key Characteristics:**

- Dark operational canvas with clearly stepped graphite surfaces.
- Signal Cyan reserved for actions, active state, focus, and high-value data.
- Single-family Poppins typography with strong weight contrast.
- Rounded, bordered panels that feel substantial without looking soft.
- Fast, visible interaction feedback through lift, glow, and tonal change.

## Colors

Signal Cyan leads a tightly controlled graphite palette; white and cool gray establish hierarchy while status colors remain literal and easy to distinguish.

### Primary

- **Signal Cyan:** The brand and interaction signal for primary actions, active navigation, focused fields, selected controls, links, and important values.
- **Bright Signal Cyan:** A higher-energy hover emphasis used sparingly when a control needs a clearer interactive response.

### Secondary

- **Deep Signal Cyan:** The darker endpoint of the primary action gradient and a supporting cyan for depth without introducing another hue.

### Neutral

- **Control Black:** The page, top-level shell, and deepest navigation background.
- **Control Graphite:** A secondary structural layer for sidebars, disabled controls, and nested regions.
- **Control Panel:** The default card, popover, and dialog surface.
- **Control Raised:** Inputs, headers, quiet controls, and inset stat blocks.
- **Control Hover:** The raised interactive state for cards and neutral buttons.
- **Polar White:** Primary headings, key labels, and high-priority values.
- **Cool Gray:** Body copy and secondary information.
- **Muted Gray:** Metadata, placeholders, disabled text, and tertiary labels.
- **Subtle Border:** Default separation between surfaces.
- **Strong Border:** Rarely used when a neutral boundary needs more definition.
- **Signal Border:** Selected, focused, and brand-emphasized boundaries.

### Tertiary

- **Success:** Enabled, saved, healthy, and positive states.
- **Error:** Failed, destructive, and invalid states.
- **Warning:** Admin-only, cautionary, premium, or attention-required states.

### Named Rules

**The Signal, Not Scenery Rule.** Signal Cyan marks action, state, or meaning; it does not become a large decorative wash behind ordinary content.

**The Graphite Ladder Rule.** Adjacent structural layers must move through the established dark surfaces so hierarchy remains legible even without cyan.

**The Literal Status Rule.** Success, error, and warning colors communicate their state directly and never replace the primary brand signal for ordinary actions.

## Typography

**Display Font:** Poppins (with sans-serif fallback)

**Body Font:** Poppins (with sans-serif fallback)

**Label/Mono Font:** Poppins for interface labels; the system monospace stack is reserved for logs and raw data.

**Character:** Poppins gives the product a clean, contemporary geometry that stays friendly at marketing scale and disciplined inside dense controls. Hierarchy comes from size and strong weight contrast rather than multiple typefaces.

### Hierarchy

- **Display** (800, fluid from 3rem to 5rem, 1.1): Homepage hero statements only.
- **Headline** (700, 32px, 1.2): Primary page titles and major dashboard destinations; reduce to 28px on compact screens.
- **Title** (600, 18px, 1.35): Card headings, section titles, and important control labels.
- **Body** (400, 14–16px, 1.6): Instructions, descriptions, supporting content, and most dashboard data. Observatory member surfaces use the 16px end of the range for explanatory copy.
- **Compact Body** (400–650, 13px, 1.5–1.6): Feature lists, navigation, secondary actions, and short readable supporting copy where 14px would create unnecessary density.
- **Dense Data** (500–600, 12px, 1.5): Secondary values and concise metadata inside operational ledgers; never use it for instructions or explanatory prose.
- **Label** (600, 11px, 0.5px tracking, uppercase): Navigation groups, compact status, and metadata categories.
- **Caption** (500, 10px, 1.4): Very short secondary annotations attached to a clearly labeled object.
- **Telemetry** (600, 8–9px, 0.08em tracking, uppercase): Orbit identifiers, topology counts, tier markers, and machine-like readouts only.

### Named Rules

**The Weight Builds Hierarchy Rule.** Use Poppins weight and size to establish importance; do not introduce a display face to manufacture personality.

**The Uppercase Is Metadata Rule.** Uppercase belongs to short group labels and status chips, never paragraphs or primary actions.

**The Readability Boundary Rule.** Instructions and explanatory copy use the 14px body role; feature lists, navigation, and actions use at least the 13px compact role. Only terse metadata and machine-like telemetry may fall below 11px.

## Layout

The dashboard is a fixed-shell workspace: a 56px top bar, a 72px guild rail, a 280px navigation sidebar, and a flexible content region offset by their combined 352px width. Working pages use a focused 960–1080px maximum where configuration density benefits from a stable reading width, while the main canvas keeps 40px outer padding. Content rhythm is built from 8px and 4px increments, with 16–24px internal panel spacing and 32–40px separation between major groups.

At 768px and below, the guild rail disappears, navigation becomes a left drawer with a dimmed backdrop, current-guild context moves into a 52px mobile bar, and the main region loses its fixed offset and uses 20px padding. Grids collapse by task: dashboard content stacks, admin tables become labeled card rows, and full-width primary actions are preferred when horizontal competition would reduce clarity. Marketing content uses a centered 1200px container with 20px gutters; feature cards flow responsively, while pricing moves from four columns to two at 1180px and one at 640px.

**The Shell Before Page Rule.** Preserve top-bar, rail, sidebar, and content offsets as one responsive system; do not solve page layout by locally compensating for shell geometry.

**The Dense, Never Cramped Rule.** Compact labels and rows may be tight, but primary interactive targets remain at least 44px high and panel padding stays generous enough for confident operation.

**The Container Must Earn Its Border Rule.** Use a complete framed panel only for a selectable object, independent workflow, overlay, or meaningfully distinct data group. Repeated child metrics and field groups use a segmented grid, tonal step, or divider instead of another complete card boundary.

## Elevation & Depth

The system is layered at rest and gains cyan lift on interaction. Tonal steps and subtle white borders establish most hierarchy. Dark ambient shadows separate overlays and menus from the canvas; cyan shadows belong to primary actions, selected emphasis, and hover feedback. Backdrop blur is reserved for persistent top bars, mobile backdrops, and intentionally translucent controls.

### Shadow Vocabulary

- **Panel Rest** (`0 2px 10px rgba(0, 0, 0, 0.3)`): Default card separation on the dark canvas.
- **Signal Lift** (`0 8px 24px rgba(0, 217, 255, 0.3)`): Interactive card hover and brand emphasis.
- **Primary Control** (`0 4px 16px rgba(0, 217, 255, 0.3)`): Resting primary action; expands on hover.
- **Overlay** (`0 18px 50px rgba(0, 0, 0, 0.45)`): Menus, dialogs, detail panels, and side editors.
- **Focus Ring** (`0 0 0 3px rgba(0, 217, 255, 0.3)`): Keyboard and field focus against raised graphite.

### Named Rules

**The Layered-at-Rest Rule.** Establish hierarchy with graphite tone and border before reaching for shadow.

**The Cyan Lift Rule.** Cyan glow must correspond to interaction, selection, or primary action; never apply it indiscriminately to every panel.

## Shapes

Acosmibot uses gently rounded geometry with enough firmness to feel like an operational tool. Standard controls and inputs use an 8px radius, menus use 10px, compact tiles and icons use 12px, and primary cards use the distinctive 15px radius. Larger dialogs and marketing moments may reach 16–20px. Pills are reserved for hero calls to action and true capsule controls; avatars and server identities remain circular.

Borders are typically one pixel and low contrast. Signal borders identify selection and focus. Clipping is functional—used for media, embed previews, cards, and contained header treatments—not as ornamental masking.

**The Radius Has Rank Rule.** Radius increases with component scale: controls are tighter than cards, and cards are tighter than dialogs.

**The Pill Is Exceptional Rule.** Do not turn routine dashboard buttons, fields, tags, or cards into capsules.

## Public Constellation Mode

Public marketing surfaces extend the command deck into a spatial observatory. This is the marketing expression of the same product identity, not a separate brand.

- **Physical scene:** A community owner is exploring the product in a dim desktop environment; the page behaves like a living systems map under an instrument panel.
- **Canvas:** Use Observatory Void (`#05080D`) and Deep Space (`#08111A`) as page-scale fields. Quiet cyan and violet nebula depth may occupy broad background regions because they describe the graph's space, not ordinary content surfaces.
- **Nodes and links:** Product capabilities are nodes with distinct circle, diamond, square, or hexagonal marks. Fine curved links express real feature relationships. Signal Cyan denotes the selected node and primary action; violet and warm coral separate feature families without replacing semantic status colors.
- **Panels:** Inspector surfaces use translucent Observatory Panel (`rgba(13, 21, 29, 0.94)`) with blur only where content genuinely floats over the graph. Borders are cool-white at low opacity.
- **Typography:** Poppins remains the product voice. Monospace is limited to topology readouts, node counts, and graph metadata.
- **Motion:** The graph breathes through slow orbital drift and link emphasis. Selection resolves into one deliberate inspector transition. Reduced-motion users receive the same topology and content without drift.
- **Responsive behavior:** Desktop uses spatial positioning and an adjacent inspector. Mobile converts the graph into a horizontally scrollable node rail above the inspector; it never shrinks labels into an unreadable miniature.
- **Marketing proof:** The homepage proves breadth through the interactive feature topology. It does not add testimonials, customer marks, benchmarks, or fabricated activity data.
- **Pricing trajectory:** Pricing turns the constellation into a decision instrument. Plans are stations around one shared core, billing cadence is one page-level control, and the comparison reads as accumulating capacity from Free through Max.
- **Documentation reading mode:** Documentation turns the constellation into an observatory field manual. A compact topic index and optional section-signal rail surround one calm, opaque reading column; article content never competes with a decorative graph. Mobile collapses the topic index into a below-header drawer and keeps a single full-width reading flow.
- **Governance records:** Terms and Privacy render as a governance constellation around one continuous, opaque legal ledger. The record header exposes revision and section count, the desktop index stays sticky, and mobile moves the same anchors into an expandable in-document index. Legal clauses are never fragmented into equal cards or obscured by decorative topology.
- **Lost-signal recovery:** The 404 route turns the failed pathname into a disconnected coral node surrounded by clickable known routes. Recovery copy and Return home lead the first viewport; topology provides real Home, Documentation, and Servers exits rather than ornamental wayfinding.
- **Leaderboard signal array:** Leaderboards turn live rank data into a connected ascent path. The top three entries are distinct gold, silver, and copper beacons backed by opaque surfaces; ranks four onward use a compact field ledger. Privacy masking, current-user selection, and profile eligibility remain legible before decorative rank signals.
- **Tier signals:** Every plan display uses the shared Acosmibot tier portrait rather than generic gems, robots, shields, or sparkles. Free uses the official logo. Paid tiers preserve one mascot, crop, and cyan-eye identity while the chest reactor escalates: Plus has a compact green core, Pro adds a brighter cyan core and armor conduits, and Max uses the largest coral-white reactor with the densest contained energy network. These hues identify plan paths only; they do not replace literal status colors.

## Operational Observatory Mode

Authenticated selection and control surfaces use a restrained operational expression of the constellation language. They share the observatory canvas, typography, and signal vocabulary while making identity, permission, state, and the next action more important than spectacle.

- **Server catalog:** Server selection groups live guilds by access level before presenting individual destinations. Owner and administrator servers lead to configuration; member servers lead to their public leaderboard. Real guild identity, membership, tier, and permission state are the proof.
- **Owner console:** The super-admin surface uses a persistent subsystem rail beside one focused workspace. The owner boundary is explicit in the first viewport, modules retain stable positions, and dense data stays on opaque ledger surfaces.
- **Server control matrix:** Guild administration keeps a compact coordinate rail for manageable servers, a grouped subsystem rail, one persistent server-context bar, and a focused configuration workspace. Live state, permission scope, dirty state, and the save action outrank decorative topology. Builders may use a split form/preview workspace, while ordinary settings remain a stable single reading column.
- **Member observatory:** Profile, Achievements, Settings, and Card Studio share one compact member-signal navigation strip but keep different working geometries. The profile is a permission-aware dossier anchored by the real rank card; achievements form a tiered progression atlas; settings route visibility and context through grouped signal controls; Card Studio pairs a sticky live rank-card preview with material trays for try-on, equip, and purchase.
- **Shared navigation relay:** The mobile drawer and account panel use opaque observatory fields, grouped route labels, Lucide subsystem glyphs, and small cyan route nodes. Identity and connection proof lead the account panel, while profile navigation and logout remain visibly separate actions; the mobile account card must never double as a logout control.
- **Signal restraint:** Cyan marks the active subsystem and primary action. Green, coral, and tier colors keep their literal status meanings. Decorative orbits may frame identity and aggregate counts, but never compete with live rows or controls.
- **Responsive behavior:** Server bands become one-column catalogs. The owner module rail becomes a compact two-column selector above its workspace, and tables become labeled record cards instead of forcing horizontal page scroll.
- **Motion and depth:** Operational surfaces animate only state changes, loading signals, and deliberate hover or focus feedback. Panels are opaque enough for sustained reading; blur is reserved for true overlays.

## Components

Components should feel tactile and confident: substantial enough to invite action, restrained enough to support long configuration sessions.

### Buttons

- **Shape:** Dashboard buttons use a gently curved control radius (8px); homepage hero calls to action use a deliberate pill.
- **Primary:** Signal Cyan-to-deep-cyan fill, control-black text in the dashboard, semibold weight, a 44px minimum target, and medium-to-generous horizontal padding.
- **Hover / Focus:** Lift by 1–2px, strengthen the cyan shadow, and retain a clearly visible focus ring. State changes use approximately 200–300ms ease.
- **Secondary / Ghost:** Raised graphite or transparent fill, Polar White text, and a subtle border that shifts toward the signal border on hover.

### Chips

- **Style:** Compact uppercase labels use translucent semantic fills, a matching low-opacity border, 6px corners, and the label type role.
- **State:** Enabled is green and explicit; disabled is neutral and muted. Selection chips use the cyan overlay and signal border rather than inventing another accent.

### Cards / Containers

- **Corner Style:** Firm, gently rounded primary cards (15px), with 12–16px variants for smaller modules.
- **Background:** Control Panel at rest, Control Hover for interaction, and Control Raised for inset regions or headers.
- **Shadow Strategy:** Use Panel Rest by default and Signal Lift only when the card is interactive.
- **Border:** One-pixel subtle border at rest; signal border for selection or hover.
- **Internal Padding:** 20–24px for dashboard panels and 32px for expansive marketing cards.
- **Hierarchy:** Frame a responsibility once. Use shared perimeter plus one-pixel internal dividers for repeated metrics, and a tonal inset without its own perimeter for subordinate field groups.

### Inputs / Fields

- **Style:** Raised graphite fill, subtle border, Polar White value text, Cool Gray supporting copy, and an 8px radius.
- **Focus:** Shift the border to Signal Cyan and add the cyan focus ring without changing layout.
- **Error / Disabled:** Disabled fields move down to Control Graphite with muted text and reduced opacity. Errors use the error color in label, border, or helper text and retain readable contrast.

### Navigation

Navigation is compact and sectional. Body-sized item labels use Cool Gray at rest and Polar White when active. Hover introduces the quiet cyan overlay; active state uses the stronger overlay. Section headers use uppercase label typography and Signal Cyan. On mobile, the navigation becomes a drawer with the same hierarchy rather than a separate visual system.

### Feature Toggle

The feature toggle is a signature configuration pattern: a full card combines title, description, explicit Active/Disabled chip, and native switch. Enabled state changes the entire container to the quiet cyan overlay with a signal border, making system state understandable before the user locates the control.

### Save Bar

Unsaved work appears as a fixed, substantial status surface with direct Save and Discard actions. The same component becomes a semantic success or error confirmation after mutation, using a matching border and ambient status shadow while retaining the Control Panel base.

## Do's and Don'ts

### Do:

- **Do** use Signal Cyan to show where the user can act, what is selected, or which value deserves attention.
- **Do** step through the established graphite surfaces to separate shell, panel, inset, and hover layers.
- **Do** keep dashboard pages scan-friendly with compact labels, 20–24px panel padding, and 32–40px major-group spacing.
- **Do** preserve visible hover, focus-visible, active, disabled, loading, success, and error feedback.
- **Do** retain Poppins and use weight contrast to connect marketing and product surfaces.
- **Do** keep explanatory copy at 14px or larger, feature lists and actions at 13px or larger, and primary touch targets at least 44px high.
- **Do** use segmented grids, dividers, or tonal steps when several related values or fields belong to one parent responsibility.

### Don't:

- **Don't** flatten the interface into generic enterprise SaaS white, gray, and brand-blue conventions.
- **Don't** flood large ordinary surfaces with Signal Cyan or persistent neon glow.
- **Don't** introduce unrelated accent hues for routine features when cyan or a literal status color already communicates the role.
- **Don't** use pill geometry for routine dashboard controls or inflate card radius beyond its place in the shape hierarchy.
- **Don't** create page-local shell offsets, sidebars, or mobile navigation rules that conflict with the shared responsive frame.
- **Don't** nest a complete bordered card inside another complete bordered card or give every section equal visual authority.
