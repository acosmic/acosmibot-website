export function avatarSource(entry) {
  const raw = entry.avatar || entry.avatarUrl || entry.avatar_url;
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && (/^(?:cdn\.discordapp\.com|media\.discordapp\.net)$/i.test(url.hostname))
      ? `/discord-cdn${url.pathname}${url.search}` : null;
  } catch {
    return raw.startsWith('/discord-cdn/') ? raw : null;
  }
}
