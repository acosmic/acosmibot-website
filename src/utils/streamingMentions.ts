/** Preserve legacy selections while exposing one clear control per ping type. */
export function normalizeStreamingMentions(streamer: Record<string, unknown>, guildId: string) {
  const legacy = typeof streamer.mention === 'string' ? streamer.mention.trim().toLowerCase() : '';
  const roleIds = Array.isArray(streamer.mention_role_ids)
    ? streamer.mention_role_ids.filter((id): id is string => typeof id === 'string')
    : [];
  const legacyRole = /^<@&([0-9]{1,20})>$/.exec(legacy)?.[1];
  if (legacyRole && !roleIds.includes(legacyRole)) roleIds.push(legacyRole);
  return {
    mention_role_ids: [...new Set(roleIds.filter(id => id !== guildId))],
    mention_everyone: roleIds.includes(guildId) || (typeof streamer.mention_everyone === 'boolean'
      ? streamer.mention_everyone : legacy === 'everyone' || legacy === '@everyone'),
    mention_here: typeof streamer.mention_here === 'boolean'
      ? streamer.mention_here : legacy === 'here' || legacy === '@here',
  };
}
