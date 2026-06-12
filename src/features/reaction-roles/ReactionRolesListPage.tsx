import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Hash, List, MousePointerClick, Plus, Smile, Sparkles, Target } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui';
import { InlineIcon } from '@/components/ui/InlineIcon';
import { reactionRolesApi, type ReactionRole } from '@/api/reactionRoles';
import { useGuildChannels } from '@/hooks/useGuildChannels';
import { showToast } from '@/utils/toast';
import { RRPreview } from './RRPreview';

const TYPE_ICONS = { emoji: Smile, button: MousePointerClick, dropdown: List } as const;

const mappingsCount = (rr: ReactionRole): number => {
  if (rr.interaction_type === 'emoji') return Object.keys(rr.emoji_role_mappings ?? {}).length;
  if (rr.interaction_type === 'button') return rr.button_configs?.length ?? 0;
  return rr.dropdown_config?.options?.length ?? 0;
};

export const ReactionRolesListPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: channels = [] } = useGuildChannels(guildId!);
  const [previewing, setPreviewing] = useState<ReactionRole | null>(null);
  const [deleting, setDeleting] = useState<ReactionRole | null>(null);

  const listQuery = useQuery({
    queryKey: ['guild', guildId, 'reaction-roles'],
    queryFn: () => reactionRolesApi.list(guildId!),
  });
  const statsQuery = useQuery({
    queryKey: ['guild', guildId, 'reaction-roles', 'stats'],
    queryFn: () => reactionRolesApi.stats(guildId!),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'reaction-roles'] });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => reactionRolesApi.duplicate(guildId!, id),
    onSuccess: () => { showToast('Reaction role duplicated!', 'success'); invalidate(); },
    onError: (e) => showToast(e instanceof Error ? e.message : 'Failed to duplicate', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => reactionRolesApi.remove(guildId!, id),
    onSuccess: () => { showToast('Reaction role deleted', 'success'); invalidate(); },
    onError: (e) => showToast(e instanceof Error ? e.message : 'Failed to delete', 'error'),
  });

  if (listQuery.isLoading) return <LoadingSpinner />;

  const items = listQuery.data ?? [];
  const stats = statsQuery.data;
  const busy = duplicateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Reaction Roles</h1>
          <p>Let members self-assign roles via reactions, buttons, or dropdowns.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {stats && (
            <span style={{
              fontSize: 13, fontWeight: 600,
              color: stats.remaining <= 0 ? 'var(--error-color, #FF4444)' : 'var(--text-muted)',
            }}>
              {stats.total} / {stats.max} messages
            </span>
          )}
          <button
            className="btn primary"
            disabled={stats ? stats.remaining <= 0 : false}
            onClick={() => navigate(`/server/${guildId}/reaction-roles/new`)}
          >
            <Plus size={16} style={{ verticalAlign: '-0.15em' }} /> Create Reaction Role
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card p-5 text-center">
          <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}><Sparkles size={40} /></div>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 18 }}>No Reaction Roles Yet</h3>
          <p className="text-muted mb-0">Create your first reaction role message to let members pick their own roles.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {items.map((rr) => {
            const channelName = channels.find((c) => String(c.id) === String(rr.channel_id))?.name ?? 'Unknown Channel';
            const TypeIcon = TYPE_ICONS[rr.interaction_type] ?? Smile;
            const count = mappingsCount(rr);
            const previewText = rr.text_content || rr.embed_config?.title || rr.embed_config?.description || 'No content';
            return (
              <div key={rr.id} className="card p-3" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{
                    margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {rr.name}
                  </h3>
                  <span className={`badge ${rr.is_sent ? 'bg-success' : 'bg-secondary'}`}>
                    {rr.is_sent ? 'Sent' : 'Draft'}
                  </span>
                </div>

                <div style={{
                  fontSize: 13, color: 'var(--text-secondary)', flex: 1,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {previewText}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                  <span><InlineIcon icon={Hash} /> {channelName}</span>
                  <span><InlineIcon icon={TypeIcon} /> {rr.interaction_type.charAt(0).toUpperCase() + rr.interaction_type.slice(1)}</span>
                  <span><InlineIcon icon={Target} /> {count} mapping{count !== 1 ? 's' : ''}</span>
                </div>

                <button
                  onClick={() => setPreviewing(rr)}
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
                    onClick={() => navigate(`/server/${guildId}/reaction-roles/edit/${rr.id}`)}>
                    Edit
                  </button>
                  <button className="btn btn-sm" disabled={busy}
                    style={{ border: '1px solid var(--border-light)', color: 'var(--text-primary)', background: 'transparent' }}
                    onClick={() => duplicateMutation.mutate(rr.id)}>
                    Duplicate
                  </button>
                  <button className="btn btn-sm" disabled={busy}
                    style={{ border: '1px solid var(--error-color, #FF4444)', color: 'var(--error-color, #FF4444)', background: 'transparent' }}
                    onClick={() => setDeleting(rr)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {previewing && (
        <Modal onClose={() => setPreviewing(null)}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
            {previewing.name}
          </h3>
          <RRPreview
            textContent={previewing.text_content}
            embedConfig={previewing.embed_config}
            interactionType={previewing.interaction_type}
            emojiMappings={previewing.emoji_role_mappings}
            buttonConfigs={previewing.button_configs}
            dropdownConfig={previewing.dropdown_config}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn" onClick={() => setPreviewing(null)}>Close</button>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal onClose={() => setDeleting(null)}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Delete reaction role</h3>
          <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 14 }}>
            Are you sure you want to delete "{deleting.name}"?
            {deleting.is_sent && ' The message already sent to Discord will stop working.'}
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
