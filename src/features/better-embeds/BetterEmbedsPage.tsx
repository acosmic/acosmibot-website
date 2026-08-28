import React from 'react';
import { useParams } from 'react-router-dom';
import { FeatureToggle, LoadingSpinner, SaveBar } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import type { BetterEmbedsConfig } from '@/types/features';
import { useBetterEmbedsConfig } from './useBetterEmbedsConfig';

export const BetterEmbedsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, isLoading, save, isSaving, saveError } = useBetterEmbedsConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState<BetterEmbedsConfig>(data);

  if (isLoading) return <LoadingSpinner />;
  if (!form) return <div className="feature-page"><p>Unable to load embed settings.</p></div>;

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Better Social Embeds</h1>
        <p>Automatically replace supported social links with versions that embed reliably in Discord.</p>
      </div>

      <div className="feature-toggle-ledger">
        <p className="dashboard-workflow-section text-secondary mb-0">
          Acosmibot suppresses Discord&apos;s original embed and posts an improved one while keeping the
          user&apos;s message intact. It needs Send Messages and Manage Messages permissions in the channel.
        </p>

        <FeatureToggle
          enabled={form.instagram.enabled}
          onChange={(enabled) => setForm({
            instagram: { ...form.instagram, enabled },
          })}
          label="Instagram"
          description="Use InstagramFix with KKInstagram fallback for posts, reels, stories, and Instagram TV links."
          credits={[
            { label: 'InstagramFix', href: 'https://instagramfix.com' },
            { label: 'KKInstagram', href: 'https://kkinstagram.com' },
          ]}
        />

        <FeatureToggle
          enabled={form.twitter.enabled}
          onChange={(enabled) => setForm({
            twitter: { ...form.twitter, enabled },
          })}
          label="X (Twitter)"
          description="Use FixupX or FxTwitter for X and Twitter status links."
          credits={[
            { label: 'FixupX', href: 'https://fixupx.com' },
            { label: 'FxTwitter', href: 'https://fxtwitter.com' },
          ]}
        />

        <FeatureToggle
          enabled={form.bluesky.enabled}
          onChange={(enabled) => setForm({
            bluesky: { ...form.bluesky, enabled },
          })}
          label="Bluesky"
          description="Use FxBluesky for Bluesky post links."
          credits={[{ label: 'FxBluesky', href: 'https://fxbsky.app' }]}
        />

        <FeatureToggle
          enabled={form.tiktok.enabled}
          onChange={(enabled) => setForm({
            tiktok: { ...form.tiktok, enabled },
          })}
          label="TikTok"
          description="Use fxTikTok for playable videos, photos, captions, hashtags, and short links."
          credits={[{ label: 'fxTikTok', href: 'https://tnktok.com' }]}
        />

        <FeatureToggle
          enabled={form.reddit.enabled}
          onChange={(enabled) => setForm({
            reddit: { ...form.reddit, enabled },
          })}
          label="Reddit"
          description="Use vxreddit for improved Reddit post, gallery, and video embeds."
          credits={[{ label: 'vxreddit', href: 'https://vxreddit.com' }]}
        />
      </div>

      <SaveBar
        isDirty={isDirty}
        onSave={() => save(form)}
        onDiscard={resetForm}
        isSaving={isSaving}
        saveError={saveError}
      />
    </div>
  );
};
