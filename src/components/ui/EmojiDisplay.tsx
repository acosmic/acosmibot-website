import React from 'react';

/** Render Unicode directly and Discord custom emoji strings as CDN images. */
export const EmojiDisplay: React.FC<{ emoji: string }> = ({ emoji }) => {
  const match = emoji.match(/^<(a?):([^:]+):(\d+)>$/);
  if (!match) return <>{emoji}</>;

  const [, animated, name, id] = match;
  return (
    <img
      className="discord-emoji-img"
      src={`https://cdn.discordapp.com/emojis/${id}.${animated === 'a' ? 'gif' : 'webp'}`}
      alt={`:${name}:`}
      title={`:${name}:`}
      style={{ width: '1em', height: '1em', objectFit: 'contain', verticalAlign: '-0.125em' }}
    />
  );
};
