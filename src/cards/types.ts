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
   *  - ringColor:   avatar border + subtle glow (default black)
   */
  loadout?: {
    accentColor?: string;
    background?: string;
    ringColor?: string;
  };
}
