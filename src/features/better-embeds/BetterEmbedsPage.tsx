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

      <div className="card p-4 mb-4">
        <p className="text-secondary mb-4">
          Acosmibot suppresses Discord&apos;s original embed and posts an improved one while keeping the
          user&apos;s message intact. It needs Send Messages and Manage Messages permissions in the channel.
        </p>

        <FeatureToggle
          enabled={form.instagram.enabled}
          onChange={(enabled) => setForm({
            instagram: { ...form.instagram, enabled },
          })}
          label="Instagram"
          description="Use KKInstagram for posts, reels, stories, and Instagram TV links."
        />

        <FeatureToggle
          enabled={form.twitter.enabled}
          onChange={(enabled) => setForm({
            twitter: { ...form.twitter, enabled },
          })}
          label="X (Twitter)"
          description="Use FixupX or FxTwitter for X and Twitter status links."
        />

        <FeatureToggle
          enabled={form.bluesky.enabled}
          onChange={(enabled) => setForm({
            bluesky: { ...form.bluesky, enabled },
          })}
          label="Bluesky"
          description="Use FxBluesky for Bluesky post links."
        />

        <FeatureToggle
          enabled={form.tiktok.enabled}
          onChange={(enabled) => setForm({
            tiktok: { ...form.tiktok, enabled },
          })}
          label="TikTok"
          description="Use fxTikTok for playable videos, photos, and short links."
        />

        <FeatureToggle
          enabled={form.reddit.enabled}
          onChange={(enabled) => setForm({
            reddit: { ...form.reddit, enabled },
          })}
          label="Reddit"
          description="Use vxreddit for improved Reddit post, gallery, and video embeds."
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
