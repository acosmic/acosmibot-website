import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui';
import { DiscordEmbedPreview } from '@/components/ui/DiscordEmbedPreview';
import { embedsApi, type GuildEmbed } from '@/api/embeds';
import { showToast } from '@/utils/toast';

export const EmbedsListPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewing, setPreviewing] = useState<GuildEmbed | null>(null);
  const [deleting, setDeleting] = useState<GuildEmbed | null>(null);

  const embedsQuery = useQuery({
    queryKey: ['guild', guildId, 'embeds'],
    queryFn: () => embedsApi.list(guildId!),
  });
  const statsQuery = useQuery({
    queryKey: ['guild', guildId, 'embeds', 'stats'],
    queryFn: () => embedsApi.stats(guildId!),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'embeds'] });
  };

  const duplicateMutation = useMutation({
    mutationFn: (embedId: number) => embedsApi.duplicate(guildId!, embedId),
    onSuccess: () => { showToast('Embed duplicated!', 'success'); invalidate(); },
    onError: (e) => showToast(e instanceof Error ? e.message : 'Failed to duplicate embed', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (embedId: number) => embedsApi.remove(guildId!, embedId),
    onSuccess: () => { showToast('Embed deleted', 'success'); invalidate(); },
    onError: (e) => showToast(e instanceof Error ? e.message : 'Failed to delete embed', 'error'),
  });

  if (embedsQuery.isLoading) return <LoadingSpinner />;

  const embeds = embedsQuery.data ?? [];
  const stats = statsQuery.data;
  const busy = duplicateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Better Embeds</h1>
          <p>Build rich Discord embed messages and send them to your channels.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {stats && (
            <span style={{
              fontSize: 13, fontWeight: 600,
              color: stats.total >= stats.limit ? 'var(--error-color, #FF4444)' : 'var(--text-muted)',
            }}>
              {stats.total} / {stats.limit} embeds
            </span>
          )}
          <button
            className="btn primary"
            disabled={stats ? !stats.can_create_more : false}
            onClick={() => navigate(`/server/${guildId}/embeds/new`)}
          >
            <Plus size={16} style={{ verticalAlign: '-0.15em' }} /> Create Embed
          </button>
        </div>
      </div>

      {embeds.length === 0 ? (
        <div className="card p-5 text-center">
          <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}><FileText size={40} /></div>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 18 }}>No Embeds Yet</h3>
          <p className="text-muted mb-0">Create your first embed to send rich messages to your server.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {embeds.map((embed) => (
            <div key={embed.id} className="card p-3" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <h3 style={{
                  margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {embed.name}
                </h3>
                <span className={`badge ${embed.is_sent ? 'bg-success' : 'bg-secondary'}`}>
                  {embed.is_sent ? 'Sent' : 'Draft'}
                </span>
              </div>

              <div style={{
                fontSize: 13, color: 'var(--text-secondary)', flex: 1,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {embed.embed_config?.description || embed.embed_config?.title || 'No content'}
              </div>

              <button
                onClick={() => setPreviewing(embed)}
                style={{
                  background: 'none', border: 'none', color: 'var(--primary-color)',
                  fontSize: 12, cursor: 'pointer', padding: 0, textAlign: 'left',
                }}
              >
                See Preview
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" disabled={busy}
                  style={{ border: '1px solid var(--border-light)', color: 'var(--text-primary)', background: 'transparent' }}
                  onClick={() => navigate(`/server/${guildId}/embeds/edit/${embed.id}`)}>
                  Edit
                </button>
                <button className="btn btn-sm" disabled={busy}
                  style={{ border: '1px solid var(--border-light)', color: 'var(--text-primary)', background: 'transparent' }}
                  onClick={() => duplicateMutation.mutate(embed.id)}>
                  Duplicate
                </button>
                <button className="btn btn-sm" disabled={busy}
                  style={{ border: '1px solid var(--error-color, #FF4444)', color: 'var(--error-color, #FF4444)', background: 'transparent' }}
                  onClick={() => setDeleting(embed)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewing && (
        <Modal onClose={() => setPreviewing(null)}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
            {previewing.name}
          </h3>
          <DiscordEmbedPreview
            config={previewing.embed_config ?? {}}
            buttons={previewing.buttons ?? []}
            messageText={previewing.message_text ?? ''}
            showCharCount={false}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn" onClick={() => setPreviewing(null)}>Close</button>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal onClose={() => setDeleting(null)}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Delete embed</h3>
          <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 14 }}>
            Are you sure you want to delete "{deleting.name}"? This cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn" onClick={() => setDeleting(null)}>Cancel</button>
            <button className="btn"
              style={{ border: '1px solid var(--error-color, #FF4444)', color: 'var(--error-color, #FF4444)', background: 'transparent' }}
              onClick={() => { deleteMutation.mutate(deleting.id); setDeleting(null); }}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Modal: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-cyan)', borderRadius: 16,
        padding: 24, maxWidth: 600, width: '100%', maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}
    >
      {children}
    </div>
  </div>
);
