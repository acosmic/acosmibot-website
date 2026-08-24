/**
 * Data contract for rendering a rank card.
 *
 * This single shape is shared by three surfaces so they can never drift:
 *  - the live <RankCard> preview rendered in the browser (Card Studio)
 *  - the Azure SWA `render-card` function (Satori -> PNG, the canonical image)
 *  - the bot, which builds this payload and POSTs it to the function
 *
 * Keep every field primitive/JSON-serializable.
 */
export interface RankCardData {
  /** Discord username (used for profile links elsewhere; not drawn). */
  username: string;
  /** Name drawn large on the card — global_name or name. */
  displayName: string;
  /**
   * Avatar image source. In the browser this is the Discord CDN URL; the
   * render function pre-fetches it and substitutes a base64 data URI before
   * handing the data to Satori (Satori needs image bytes, not a bare URL).
   */
  avatarUrl: string;
  /** Guild the card is shown for — drawn as "in {guildName}". */
  guildName: string;
  /** Rank position within the guild. */
  rank: number;
  /** Guild level. */
  level: number;
  /** Global (cross-server) level, drawn small top-right. */
  globalLevel: number;
  /** Total guild XP, drawn in the XP label. */
  currentExp: number;
  /** XP earned within the current level. */
  expProgress: number;
  /** XP needed to advance from the current level to the next. */
  expNeeded: number;
  /**
   * Optional cosmetic loadout — resolved CSS values from the user's equipped
   * cosmetics. Any field that is absent falls back to the card's hardcoded
   * default, so the card renders identically with no loadout at all.
   *
   *  - accentColor: level text + XP-bar fill (default cyan)
   *  - background:  root background — a hex color or a CSS gradient string
   *                 (default #18191c)
   *  - backgroundImageUrl: immutable owner-uploaded 800×250 artwork
   *  - layoutPreset: 'artwork' shortens only the XP track to half length
   *  - ringColor:   avatar border + subtle glow (default black)
   */
  loadout?: {
    accentColor?: string;
    background?: string;
    backgroundImageUrl?: string;
    layoutPreset?: 'standard' | 'artwork';
    ringColor?: string;
    /**
     * Key of the equipped background cosmetic, when it's a special one whose
     * card carries extra ornamentation (e.g. 'og_member' → gold filigree frame
     * + embossed OG monogram). Absent for ordinary backgrounds.
     */
    backgroundKey?: string;
  };
  /**
   * Website-only overrides (the bot never sets these, so the Discord/Satori
   * card is unaffected). They let the same component render a "global" variant
   * on the profile:
   *  - topLeftLabel: replaces the "in {guildName}" label verbatim (no "in").
   *  - hideGlobalLevel: hides the top-right "Global Lvl N" (redundant when the
   *    main LVL already shows the global level).
   */
  topLeftLabel?: string;
  hideGlobalLevel?: boolean;
}

/**
 * Data contract for rendering a weather card.
 *
 * Shares the `render-card` function with {@link RankCardData}; `card: 'weather'`
 * selects this component. Every temperature arrives as a **pre-formatted display
 * string** already converted to the requested unit by the bot, so the component
 * holds no conversion logic and the °C/°F toggle cannot disagree with the text
 * reply beside it.
 */
export interface WeatherCardData {
  /** Discriminator that routes the payload to <WeatherCard>. */
  card: 'weather';
  /** Canonical place label, e.g. "Houston, TX, US". */
  location: string;
  /** Current temperature with its degree sign, e.g. "91°F". */
  temperature: string;
  /** Human condition text, e.g. "Scattered clouds". */
  condition: string;
  /** Secondary line, e.g. "H:92°F  L:87°F · Feels 104°F". */
  detail: string;
  /**
   * OpenWeatherMap icon id for the current conditions ("01d".."50n"). Drives
   * both the hero glyph and the sky gradient; the trailing d/n selects day or
   * night styling.
   */
  iconCode: string;
  /** Up to five forecast columns, today first. */
  days: WeatherCardDay[];
}

export interface WeatherCardDay {
  /** Column heading — "TODAY" for the first entry, otherwise "Mon". */
  label: string;
  /** OpenWeatherMap icon id for the day's dominant condition. */
  iconCode: string;
  /** Formatted high, e.g. "96°F". */
  high: string;
  /** Formatted low, e.g. "88°F". */
  low: string;
}

/** JSON contract for the public `/ai status` telemetry card. */
export interface AIStatusCardData {
  /** Selects <AIStatusCard> in the shared render function. */
  card: 'ai-status';
  guildName: string;
  status: 'enabled' | 'server-disabled' | 'globally-disabled' | 'not-configured';
  statusLabel: string;
  statusDetail: string;
  tierName: string;
  monthlyReset: string;
  accessLabel: string;
  accessTerm: string;
  usage: AIStatusUsage[];
  guildCreditImages: number;
  personalCreditImages: number;
  serverCredits: number;
  ambientAvailable: boolean;
  ambientRepliesEnabled: boolean;
  ambientImagesEnabled: boolean;
  personalityName: string;
  personalityTraits: string;
  personalityTemporary: boolean;
  customPersonalityLocked: boolean;
}

export interface AIStatusUsage {
  key:
    | 'chat-daily'
    | 'chat-monthly'
    | 'images'
    | 'analysis'
    | 'image-search'
    | 'summary';
  label: string;
  used: number;
  limit: number;
  detail: string;
  locked: boolean;
}

/** JSON contract for the rendered World of Warcraft profile overview. */
export interface WowProfileCardData {
  /** Selects <WowProfileCard> in the shared render function. */
  card: 'wow-profile';
  characterName: string;
  realmName: string;
  region: string;
  versionLabel: string;
  level: number;
  race: string;
  characterClass: string;
  faction: string;
  guildName: string;
  itemLevel: number;
  /** Retail uses its active specialization; Classic uses tree-point totals. */
  isRetail: boolean;
  activeSpec: string;
  /** Blizzard's HTTPS `main-raw` render; inlined by the server before Satori. */
  characterImageUrl: string;
  stats: WowProfileStat[];
  talents: WowProfileTalent[];
  footer: string;
}

export interface WowProfileStat {
  label: string;
  value: string;
}

export interface WowProfileTalent {
  name: string;
  points: number;
}
