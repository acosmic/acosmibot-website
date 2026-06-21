import React from 'react';
import { useParams } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { CollapsibleSection, FeatureToggle, LoadingSpinner, SaveBar } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { GamesConfig } from '@/types/features';
import { useGamesConfig } from './useGamesConfig';
import { SlotsSection } from './SlotsSection';
import { HeistSection } from './HeistSection';
import { SimpleGameSection } from './SimpleGameSection';

export const GamesPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, availableEmojis, isLoading, isError, save, isSaving, saveError } = useGamesConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState<GamesConfig>(data);

  if (isLoading) return <LoadingSpinner />;
  // config-hybrid is admin-gated; a 403 means the viewer can't manage settings.
  if (isError || !form) return <div className="feature-page"><p>Unable to load game settings.</p></div>;

  const masterOff = !form.enabled;

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Games</h1>
        <p>Enable and configure every game and gambling feature for your server in one place.</p>
      </div>

      <FeatureToggle
        label="Games Enabled"
        enabled={form.enabled}
        onChange={(v) => setForm({ enabled: v })}
        description="Master switch for all games. When off, every game below is disabled regardless of its own toggle."
      />

      {masterOff && (
        <div
          className="card p-3 mb-4 d-flex align-items-center gap-2"
          style={{ border: '1px solid var(--error-color, #ef4444)', color: 'var(--error-color, #ef4444)' }}
        >
          <TriangleAlert size={18} />
          <span>Games are turned off for this server — the individual games below are inactive until you re-enable the master switch.</span>
        </div>
      )}

      <div style={{ opacity: masterOff ? 0.5 : 1, pointerEvents: masterOff ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
        <CollapsibleSection title="Slots" defaultOpen>
          <SlotsSection
            value={form.slots}
            onChange={(updates) => setForm({ slots: { ...form.slots, ...updates } })}
            availableEmojis={availableEmojis}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Bank Heist">
          <HeistSection
            guildId={guildId!}
            value={form.heist}
            onChange={(updates) => setForm({ heist: { ...form.heist, ...updates } })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Blackjack">
          <SimpleGameSection
            command="/blackjack"
            description="Play blackjack against the dealer."
            enabled={form.blackjack.enabled}
            onChange={(v) => setForm({ blackjack: { ...form.blackjack, enabled: v } })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Coinflip">
          <SimpleGameSection
            command="/coinflip"
            description="Flip a coin for a chance to win credits."
            enabled={form.coinflip.enabled}
            onChange={(v) => setForm({ coinflip: { enabled: v } })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Rock Paper Scissors">
          <SimpleGameSection
            command="/rockpaperscissors"
            description="Challenge another member to a best-of-three duel."
            enabled={form.rps.enabled}
            onChange={(v) => setForm({ rps: { enabled: v } })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Deathroll">
          <SimpleGameSection
            command="/deathroll"
            description="Take turns rolling down — first to hit 1 loses the pot."
            enabled={form.deathroll.enabled}
            onChange={(v) => setForm({ deathroll: { enabled: v } })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Mines">
          <SimpleGameSection
            command="/mines"
            description="Reveal safe tiles and cash out before hitting a mine."
            enabled={form.mines.enabled}
            onChange={(v) => setForm({ mines: { enabled: v } })}
          />
        </CollapsibleSection>
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
