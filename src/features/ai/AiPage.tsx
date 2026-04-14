import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAiConfig, AiConfig } from './useAiConfig';
import { FeatureToggle, SaveBar, LoadingSpinner } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';

export const AiPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, hasAccess, tier, isLoading, save, isSaving } = useAiConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState<AiConfig>(data);

  if (isLoading) return <LoadingSpinner />;

  if (!hasAccess) {
    return (
      <div className="card p-5 text-center mt-5 mx-auto" style={{ maxWidth: '600px', border: '2px solid var(--border-cyan)', background: 'linear-gradient(135deg, var(--bg-primary), var(--bg-secondary))' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🤖</div>
        <h2 className="mb-3 fs-3 fw-bold text-primary">AI Customization is Premium</h2>
        <p className="mb-4 text-muted">Personalize your server's AI assistant with unique personalities and behaviors. This feature requires the <strong>Premium + AI</strong> tier.</p>
        <div className="d-flex flex-column gap-3">
          <Link to={`/server/${guildId}/premium`} className="btn primary py-3 fw-bold">Upgrade to Premium + AI</Link>
          <p className="small text-muted mb-0">Your current tier: <span className="text-white text-capitalize">{tier.replace(/_/g, ' ')}</span></p>
        </div>
      </div>
    );
  }

  if (!form) return <div>No data found.</div>;

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>AI Customization</h1>
        <p>Give your server's AI a unique personality and set of rules.</p>
      </div>

      <FeatureToggle 
        enabled={form.enabled} 
        onChange={(v) => setForm({ enabled: v })} 
        description="Enable AI chat and image generation for this server."
      />

      <div className="card p-4 mb-4">
        <h3 className="mb-4">Personality</h3>
        <div className="mb-3">
          <label className="form-label mb-2 d-block">AI Name</label>
          <input 
            type="text" 
            className="form-control" 
            value={form.personality_name || ''} 
            onChange={(e) => setForm({ personality_name: e.target.value })}
            placeholder="Acosmibot Assistant"
          />
        </div>
        <div className="mb-3">
          <label className="form-label mb-2 d-block">System Prompt / Description</label>
          <textarea 
            className="form-control" 
            rows={5} 
            value={form.personality_description || ''} 
            onChange={(e) => setForm({ personality_description: e.target.value })}
            placeholder="Describe how the AI should act (e.g., 'helpful assistant', 'grumpy robot', 'friendly tour guide')..."
          />
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 className="mb-4">Behavior & Memory</h3>
        <div className="mb-3">
          <label className="form-label mb-2 d-block">Memory Window (Last N Messages)</label>
          <input 
            type="number" 
            className="form-control" 
            value={form.max_memory_messages || 10} 
            onChange={(e) => setForm({ max_memory_messages: parseInt(e.target.value) || 10 })}
            min={1}
            max={50}
          />
          <p className="text-muted small mt-2">The number of recent messages the AI remembers in a conversation.</p>
        </div>
      </div>

      <SaveBar 
        isDirty={isDirty} 
        onSave={() => save(form)} 
        onDiscard={resetForm} 
        isSaving={isSaving} 
      />
    </div>
  );
};
