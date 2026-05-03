import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStreamPlatformConfig } from './useStreamPlatformConfig';
import { ChannelSelect, RoleMultiSelect, FeatureToggle, SaveBar, LoadingSpinner, CollapsibleSection } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { Platform, streamingApi } from '@/api/streaming';
import { Streamer } from '@/types/features';

interface StreamPlatformFeatureProps {
  platform: Platform;
}

export const StreamPlatformFeature: React.FC<StreamPlatformFeatureProps> = ({ platform }) => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, isLoading, save, isSaving, saveError } = useStreamPlatformConfig(guildId!, platform);
  const { form, setForm, isDirty, resetForm } = useDirtyState(data);
  const [selectedStreamerIndex, setSelectedStreamerIndex] = useState<number | null>(null);
  const [validatingIndex, setValidatingIndex] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});

  if (isLoading) return <LoadingSpinner />;
  if (!form) return <div>No data found.</div>;

  const platformTitle = platform.charAt(0).toUpperCase() + platform.slice(1);
  const streamerLabel = platform === 'youtube' ? 'Youtuber' : 'Streamer';
  const trackedTitle = platform === 'youtube' ? 'Tracked Youtubers' : 'Tracked Streamers';
  const emptyLabel = platform === 'youtube' ? 'No youtubers tracked yet.' : 'No streamers tracked yet.';
  const streamers = form.tracked_streamers || [];
  
  const addStreamer = () => {
    const newStreamer: Streamer = {
      platform,
      username: '',
      isValid: false,
      mention_role_ids: [],
      mention_everyone: false,
      mention_here: false,
      custom_message: null,
      skip_vod_check: false
    };
    setForm({ tracked_streamers: [...streamers, newStreamer] });
    setSelectedStreamerIndex(streamers.length);
  };

  const removeStreamer = (index: number) => {
    const newStreamers = [...streamers];
    newStreamers.splice(index, 1);
    setForm({ tracked_streamers: newStreamers });
    if (selectedStreamerIndex === index) {
      setSelectedStreamerIndex(null);
    } else if (selectedStreamerIndex !== null && selectedStreamerIndex > index) {
      setSelectedStreamerIndex(selectedStreamerIndex - 1);
    }
  };

  const updateStreamer = (index: number, updates: Partial<Streamer>) => {
    const newStreamers = [...streamers];
    newStreamers[index] = { ...newStreamers[index], ...updates };
    setForm({ tracked_streamers: newStreamers });
  };

  const handleUsernameChange = (index: number, username: string) => {
    updateStreamer(index, {
      username,
      isValid: false,
      channel_id: platform === 'youtube' ? null : streamers[index]?.channel_id,
    });
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  };

  const validateStreamer = async (index: number) => {
    const streamer = streamers[index];
    const username = streamer?.username?.trim();

    if (!username) return;

    setValidatingIndex(index);
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });

    try {
      const result = await streamingApi.validateStreamer(platform, username);

      if (result.success && result.valid) {
        updateStreamer(index, {
          username,
          isValid: true,
          channel_id: platform === 'youtube' ? result.channel_id ?? streamer.channel_id ?? null : streamer.channel_id,
        });
      } else {
        updateStreamer(index, { isValid: false });
        setValidationErrors((current) => ({
          ...current,
          [index]: result.message || `${streamerLabel} was not found.`,
        }));
      }
    } catch (error) {
      updateStreamer(index, { isValid: false });
      setValidationErrors((current) => ({
        ...current,
        [index]: error instanceof Error ? error.message : `Failed to validate ${streamerLabel.toLowerCase()}.`,
      }));
    } finally {
      setValidatingIndex((current) => (current === index ? null : current));
    }
  };

  const selectedStreamer = selectedStreamerIndex !== null ? streamers[selectedStreamerIndex] : null;
  const selectedValidationError = selectedStreamerIndex !== null ? validationErrors[selectedStreamerIndex] : null;

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>{platformTitle} Alerts</h1>
        <p>Manage streaming alerts for your server.</p>
      </div>

      <FeatureToggle 
        enabled={form.enabled} 
        onChange={(v) => setForm({ enabled: v })} 
        description={`Enable or disable ${platformTitle} notifications.`}
      />

      <div className="row">
        <div className="col-lg-5">
          <div className="card p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="mb-0">{trackedTitle}</h3>
              <button 
                className="btn primary py-2 px-3" 
                onClick={addStreamer}
                disabled={streamers.length >= 5}
              >
                + Add
              </button>
            </div>

            <div className="streamers-list">
              {streamers.length === 0 && (
                <div className="text-center p-4 text-muted">
                  {emptyLabel}
                </div>
              )}
              {streamers.map((streamer, index) => (
                <div 
                  key={index} 
                  className={`card mb-2 p-3 d-flex flex-row justify-content-between align-items-center ${selectedStreamerIndex === index ? 'border-primary' : ''}`}
                  onClick={() => setSelectedStreamerIndex(index)}
                  style={{ cursor: 'pointer', background: selectedStreamerIndex === index ? 'var(--bg-overlay)' : 'var(--bg-tertiary)' }}
                >
                  <div className="d-flex align-items-center gap-3 overflow-hidden">
                    <div className={`status-dot ${streamer.isValid ? 'bg-success' : 'bg-secondary'}`} style={{ width: '10px', height: '10px', borderRadius: '50%' }}></div>
                    <span className="text-truncate fw-bold">{streamer.username || `New ${streamerLabel}`}</span>
                  </div>
                  <div className="d-flex gap-2">
                    <button 
                      className="btn btn-sm p-1" 
                      onClick={(e) => { e.stopPropagation(); removeStreamer(index); }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--error-color)' }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-3 text-muted small">
              Limit: {streamers.length} of 5 streamers
            </div>
          </div>

          <div className="card p-4 mb-4">
            <h3 className="mb-4">Global Settings</h3>
            <ChannelSelect
              guildId={guildId!}
              value={form.announcement_channel_id}
              onChange={(v) => setForm({ announcement_channel_id: v })}
              label="Default Announcement Channel"
            />
            
            <div className="mb-3">
              <label className="form-label mb-2 d-block">Default Message</label>
              <textarea 
                className="form-control" 
                rows={3} 
                value={form.announcement_message || ''} 
                onChange={(e) => setForm({ announcement_message: e.target.value })}
                placeholder="{username} is live!"
              />
              <p className="text-muted small mt-2">Use {'{username}'}, {'{link}'}, and {'{title}'} as placeholders.</p>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          {selectedStreamerIndex !== null && selectedStreamer ? (
            <div className="card p-4 fade-in">
              <h3 className="mb-4">{streamerLabel}: {selectedStreamer.username || 'New'}</h3>
              
              <div className="mb-4">
                <label className="form-label mb-2 d-block">Username / URL</label>
                <div className="input-group">
                  <input 
                    type="text" 
                    className="form-control" 
                    value={selectedStreamer.username} 
                    onChange={(e) => handleUsernameChange(selectedStreamerIndex, e.target.value)}
                    onBlur={() => validateStreamer(selectedStreamerIndex)}
                    placeholder={platform === 'youtube' ? 'Enter channel, handle, or URL...' : 'Enter username...'}
                  />
                  {validatingIndex === selectedStreamerIndex && (
                    <span className="input-group-text bg-info text-dark small">Checking...</span>
                  )}
                  {validatingIndex !== selectedStreamerIndex && selectedStreamer.isValid && selectedStreamer.username && (
                    <span className="input-group-text bg-success text-light small">✓</span>
                  )}
                  {validatingIndex !== selectedStreamerIndex && !selectedStreamer.isValid && selectedStreamer.username && (
                    <span className="input-group-text bg-warning text-dark small">Unverified</span>
                  )}
                </div>
                {selectedValidationError && (
                  <div className="text-danger small mt-2">{selectedValidationError}</div>
                )}
              </div>

              <CollapsibleSection title="Pings & Notifications" defaultOpen={true}>
                <div className="mb-3 d-flex gap-4">
                  <div className="form-check">
                    <input 
                      type="checkbox" 
                      className="form-check-input" 
                      id="pingEveryone" 
                      checked={selectedStreamer.mention_everyone}
                      onChange={(e) => updateStreamer(selectedStreamerIndex, { mention_everyone: e.target.checked })}
                    />
                    <label className="form-check-label" htmlFor="pingEveryone">@everyone</label>
                  </div>
                  <div className="form-check">
                    <input 
                      type="checkbox" 
                      className="form-check-input" 
                      id="pingHere" 
                      checked={selectedStreamer.mention_here}
                      onChange={(e) => updateStreamer(selectedStreamerIndex, { mention_here: e.target.checked })}
                    />
                    <label className="form-check-label" htmlFor="pingHere">@here</label>
                  </div>
                </div>

                <RoleMultiSelect
                  guildId={guildId!}
                  value={selectedStreamer.mention_role_ids}
                  onChange={(v) => updateStreamer(selectedStreamerIndex, { mention_role_ids: v })}
                  label="Role Pings"
                  placeholder="Select roles to notify..."
                />
              </CollapsibleSection>

              <CollapsibleSection title="Custom Override">
                <div className="mb-3">
                  <label className="form-label mb-2 d-block">Custom Message (Optional)</label>
                  <textarea 
                    className="form-control" 
                    rows={2} 
                    value={selectedStreamer.custom_message || ''} 
                    onChange={(e) => updateStreamer(selectedStreamerIndex, { custom_message: e.target.value || null })}
                    placeholder="Overrides the global default message..."
                  />
                </div>
                <div className="form-check mb-2">
                  <input 
                    type="checkbox" 
                    className="form-check-input" 
                    id="skipVod" 
                    checked={selectedStreamer.skip_vod_check}
                    onChange={(e) => updateStreamer(selectedStreamerIndex, { skip_vod_check: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="skipVod">Skip VOD check / edits</label>
                </div>
              </CollapsibleSection>
            </div>
          ) : (
            <div className="card p-5 text-center text-muted d-flex flex-column align-items-center justify-content-center h-100">
              <div style={{ fontSize: '3rem' }}>📺</div>
              <p className="mt-3">Select a {streamerLabel.toLowerCase()} from the left to configure alerts.</p>
            </div>
          )}
        </div>
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
