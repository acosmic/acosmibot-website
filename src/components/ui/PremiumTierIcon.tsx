import React from 'react';
import type { PremiumTier } from '@/api/subscriptions';

export const PREMIUM_TIER_LABELS: Record<PremiumTier, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
  max: 'Max',
};

export const PREMIUM_TIER_ICON_SRC: Record<PremiumTier, string> = {
  free: '/images/acosmibot-logo.png',
  plus: '/images/pricing/tier-plus-icon-20261022.webp',
  pro: '/images/pricing/tier-pro-icon-20261022.webp',
  max: '/images/pricing/tier-max-icon-20261022.webp',
};

export const PREMIUM_TIER_ILLUSTRATION_SRC: Record<PremiumTier, string> = {
  free: PREMIUM_TIER_ICON_SRC.free,
  plus: '/images/pricing/tier-plus-illustration-20261022.webp',
  pro: '/images/pricing/tier-pro-illustration-20261022.webp',
  max: '/images/pricing/tier-max-illustration-20261022.webp',
};

export const normalizePremiumTier = (tier: unknown): PremiumTier => {
  if (tier === 'premium') return 'plus';
  if (tier === 'premium_plus_ai') return 'pro';
  if (tier === 'plus' || tier === 'pro' || tier === 'max') return tier;
  return 'free';
};

type PremiumTierIconProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'alt' | 'height' | 'src' | 'width'
> & {
  tier: unknown;
  size?: number;
  variant?: 'icon' | 'illustration';
  decorative?: boolean;
  alt?: string;
};

export const PremiumTierIcon: React.FC<PremiumTierIconProps> = ({
  tier,
  size = 24,
  variant = 'icon',
  decorative = true,
  alt,
  className,
  style,
  ...props
}) => {
  const normalizedTier = normalizePremiumTier(tier);
  const classes = [
    'premium-tier-icon',
    `premium-tier-icon--${normalizedTier}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <img
      {...props}
      src={(variant === 'illustration' ? PREMIUM_TIER_ILLUSTRATION_SRC : PREMIUM_TIER_ICON_SRC)[normalizedTier]}
      alt={decorative ? '' : alt ?? `${PREMIUM_TIER_LABELS[normalizedTier]} plan`}
      aria-hidden={decorative ? true : undefined}
      className={classes}
      width={size}
      height={size}
      decoding="async"
      style={{
        display: 'block',
        width: size,
        height: size,
        objectFit: 'contain',
        flex: '0 0 auto',
        ...style,
      }}
    />
  );
};
