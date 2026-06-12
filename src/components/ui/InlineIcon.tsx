import React from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Lucide icon sized and baseline-aligned for use inside running text,
 * chips, and headings. Flex containers don't need this — use the icon
 * component directly there.
 */
export const InlineIcon: React.FC<{
  icon: LucideIcon;
  size?: number | string;
  color?: string;
}> = ({ icon: Icon, size = '1em', color }) => (
  <Icon
    size={size}
    color={color}
    style={{ verticalAlign: '-0.125em', display: 'inline' }}
    aria-hidden
  />
);
