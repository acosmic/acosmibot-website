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
}
