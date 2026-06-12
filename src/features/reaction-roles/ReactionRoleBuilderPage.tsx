import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { CollapsibleSection, LoadingSpinner, RoleMultiSelect } from '@/components/ui';
import { EmojiPicker } from '@/features/slots/EmojiPicker';
import {
  reactionRolesApi,
  type RRButtonConfig, type RRDropdownOption, type RRInteractionType, type RRPayload,
} from '@/api/reactionRoles';
import { useGuildChannels } from '@/hooks/useGuildChannels';
import { useGuildEmojis } from '@/hooks/useGuildEmojis';
import { showToast } from '@/utils/toast';
import { EmojiDisplay, RRPreview } from './RRPreview';

const DEFAULT_COLOR = '#5865F2';
const MESSAGE_MAX = 2000;

const BUTTON_STYLES = [
  { value: 1, label: 'Primary (Blue)' },
  { value: 2, label: 'Secondary (Gray)' },
  { value: 3, label: 'Success (Green)' },
  { value: 4, label: 'Danger (Red)' },
];

interface EmojiMappingDraft { key: string; emoji: string; roleIds: string[] }
interface ButtonDraft extends Omit<RRButtonConfig, 'role_ids'> { key: string; roleIds: string[] }
interface DropdownOptionDraft extends Omit<RRDropdownOption, 'role_ids'> { key: string; roleIds: string[] }

/** Legacy stores the color as hex without '#'; normalize whatever we get. */
const normalizeColor = (color?: string): string =>
  color ? `#${String(color).replace(/^#+/, '')}` : DEFAULT_COLOR;

export const ReactionRoleBuilderPage: React.FC = () => {
  const { guildId, rrId } = useParams<{ guildId: string; rrId?: string }>();
  const navigate = useNavigate();
  const isEditing = !!rrId;

  const { data: channels = [] } = useGuildChannels(guildId!);
  const textChannels = channels.filter((c) => Number(c.type) === 0);
  const { data: serverEmojis = [] } = useGuildEmojis(guildId!);

  const existingQuery = useQuery({
    queryKey: ['guild', guildId, 'reaction-roles', rrId],
    queryFn: () => reactionRolesApi.get(guildId!, rrId!),
    enabled: isEditing,
  });

  // Form state
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [allowRemoval, setAllowRemoval] = useState(true);
  const [suppressRolePings, setSuppressRolePings] = useState(false);
  const [embedTitle, setEmbedTitle] = useState('');
  const [embedDescription, setEmbedDescription] = useState('');
  const [embedColor, setEmbedColor] = useState(DEFAULT_COLOR);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [footerText, setFooterText] = useState('');
  const [interactionType, setInteractionType] = useState<RRInteractionType>('emoji');
  const [emojiMappings, setEmojiMappings] = useState<EmojiMappingDraft[]>([
    { key: crypto.randomUUID(), emoji: '', roleIds: [] },
  ]);
  const [buttons, setButtons] = useState<ButtonDraft[]>([]);
  const [dropdownPlaceholder, setDropdownPlaceholder] = useState('');
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptionDraft[]>([]);
  const [isSent, setIsSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Emoji picker target: setter to receive the chosen emoji
  const [emojiTarget, setEmojiTarget] = useState<((emoji: string) => void) | null>(null);

  useEffect(() => {
    const rr = existingQuery.data;
    if (!rr || seeded) return;
    setSeeded(true);
    setName(rr.name ?? '');
    setChannelId(rr.channel_id ?? '');
    setMessageText(rr.text_content ?? '');
    setAllowRemoval(rr.allow_removal ?? true);
    setIsSent(!!rr.is_sent);
    const cfg = rr.embed_config;
    if (cfg) {
      setEmbedTitle(cfg.title ?? '');
      setEmbedDescription(cfg.description ?? '');
      setEmbedColor(normalizeColor(cfg.color));
      setThumbnailUrl(cfg.thumbnail ?? '');
      setImageUrl(cfg.image ?? '');
      setFooterText(cfg.footer ?? '');
    }
    setInteractionType(rr.interaction_type);
    if (rr.interaction_type === 'emoji' && rr.emoji_role_mappings) {
      const drafts = Object.entries(rr.emoji_role_mappings).map(([emoji, roleIds]) => ({
        key: crypto.randomUUID(), emoji, roleIds: roleIds.map(String),
      }));
      setEmojiMappings(drafts.length > 0 ? drafts : [{ key: crypto.randomUUID(), emoji: '', roleIds: [] }]);
    } else if (rr.interaction_type === 'button' && rr.button_configs) {
      setButtons(rr.button_configs.map((b) => ({
        key: crypto.randomUUID(), label: b.label, style: b.style, emoji: b.emoji, roleIds: (b.role_ids ?? []).map(String),
      })));
    } else if (rr.interaction_type === 'dropdown' && rr.dropdown_config) {
      setDropdownPlaceholder(rr.dropdown_config.placeholder ?? '');
      setDropdownOptions((rr.dropdown_config.options ?? []).map((o) => ({
        key: crypto.randomUUID(), label: o.label, description: o.description, emoji: o.emoji, roleIds: (o.role_ids ?? []).map(String),
      })));
    }
  }, [existingQuery.data, seeded]);

  if (isEditing && existingQuery.isLoading) return <LoadingSpinner />;
  if (isEditing && existingQuery.isError) {
    return (
      <div className="card p-4">
        Failed to load this reaction role.{' '}
        <button className="btn btn-sm" onClick={() => navigate(`/server/${guildId}/reaction-roles`)}>Back to list</button>
      </div>
    );
  }

  const validEmojiMappings = (): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    for (const m of emojiMappings) {
      if (m.emoji && m.roleIds.length > 0) out[m.emoji] = m.roleIds;
    }
    return out;
  };

  const validButtons = (): RRButtonConfig[] =>
    buttons.filter((b) => b.label && b.roleIds.length > 0)
      .map(({ key: _key, roleIds, ...b }) => ({ ...b, role_ids: roleIds }));

  const validDropdownOptions = (): RRDropdownOption[] =>
    dropdownOptions.filter((o) => o.label && o.roleIds.length > 0)
      .map(({ key: _key, roleIds, ...o }) => ({ ...o, role_ids: roleIds }));

  const buildPayload = (): RRPayload => {
    const payload: RRPayload = {
      name,
      channel_id: channelId || null,
      text_content: messageText,
      allow_removal: allowRemoval,
      interaction_type: interactionType,
    };
    if (embedTitle || embedDescription) {
      // Match legacy save format: the color input's '#RRGGBB' string.
      payload.embed_config = {
        title: embedTitle,
        description: embedDescription,
        color: embedColor,
        thumbnail: thumbnailUrl,
        image: imageUrl,
        footer: footerText,
      };
    }
    if (interactionType === 'emoji') payload.emoji_role_mappings = validEmojiMappings();
    if (interactionType === 'button') payload.button_configs = validButtons();
    if (interactionType === 'dropdown') {
      payload.dropdown_config = {
        placeholder: dropdownPlaceholder || 'Select roles...',
        options: validDropdownOptions(),
      };
    }
    return payload;
  };

  const validate = (): boolean => {
    if (!name.trim()) {
      showToast('Name is required', 'error');
      return false;
    }
    if (!channelId) {
      showToast('Please select a channel', 'error');
      return false;
    }
    const hasMappings =
      interactionType === 'emoji' ? Object.keys(validEmojiMappings()).length > 0 :
      interactionType === 'button' ? validButtons().length > 0 :
      validDropdownOptions().length > 0;
    if (!hasMappings) {
      showToast('Please add at least one role mapping (with a role selected)', 'error');
      return false;
    }
    return true;
  };

  const persist = async (): Promise<number | string | null> => {
    if (isEditing) {
      await reactionRolesApi.update(guildId!, rrId!, buildPayload());
      return rrId!;
    }
    const created = await reactionRolesApi.create(guildId!, buildPayload());
    return created?.id ?? null;
  };

  const saveDraft = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await persist();
      showToast(isEditing ? 'Draft updated!' : 'Draft saved!', 'success');
      navigate(`/server/${guildId}/reaction-roles`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save draft', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendToDiscord = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const id = await persist();
      if (!id) throw new Error('Failed to save reaction role');
      const res = await reactionRolesApi.send(guildId!, id, suppressRolePings);
      if (!res.success) throw new Error(res.message || 'Failed to send to Discord');
      showToast('Sent to Discord successfully!', 'success');
      navigate(`/server/${guildId}/reaction-roles`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to send to Discord', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateMessage = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await reactionRolesApi.update(guildId!, rrId!, { ...buildPayload(), suppress_role_pings: suppressRolePings });
      showToast('Message updated successfully!', 'success');
      navigate(`/server/${guildId}/reaction-roles`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update message', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>{isEditing ? 'Edit Reaction Role' : 'Create Reaction Role'}</h1>
        <p>Configure the message and role mappings — the live preview updates as you type.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        {/* Left — form */}
        <div>
          <div className="card p-4 mb-4">
            <div className="mb-3">
              <label className="form-label mb-2 d-block">Name *</label>
              <input className="form-control" type="text" value={name}
                placeholder="Internal name (not shown in Discord)"
                onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label mb-2 d-block">Target Channel *</label>
              <select className="form-control" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                <option value="">Select a channel...</option>
                {textChannels.map((c) => <option key={c.id} value={c.id}># {c.name}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label mb-2 d-block">
                Message Text <span className="text-muted">({messageText.length}/{MESSAGE_MAX})</span>
              </label>
              <textarea className="form-control" rows={3} maxLength={MESSAGE_MAX} value={messageText}
                placeholder="Plain text content of the message (optional if you use an embed)"
                onChange={(e) => setMessageText(e.target.value)} />
            </div>
            <label className="d-flex align-items-center gap-2 m-0" style={{ fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" className="form-check-input m-0" checked={allowRemoval}
                onChange={(e) => setAllowRemoval(e.target.checked)} />
              Allow members to remove the role by un-reacting / re-clicking
            </label>
          </div>

          <CollapsibleSection title="Embed (optional)" defaultOpen={!!(embedTitle || embedDescription)}>
            <div className="mb-3">
              <label className="form-label mb-2 d-block">Title</label>
              <input className="form-control" type="text" value={embedTitle} maxLength={256}
                onChange={(e) => setEmbedTitle(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label mb-2 d-block">Description</label>
              <textarea className="form-control" rows={3} maxLength={4096} value={embedDescription}
                onChange={(e) => setEmbedDescription(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label mb-2 d-block">Color</label>
              <input type="color" className="form-control form-control-color" value={embedColor}
                onChange={(e) => setEmbedColor(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label mb-2 d-block">Thumbnail URL</label>
              <input className="form-control" type="url" value={thumbnailUrl} placeholder="https://..."
                onChange={(e) => setThumbnailUrl(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label mb-2 d-block">Image URL</label>
              <input className="form-control" type="url" value={imageUrl} placeholder="https://..."
                onChange={(e) => setImageUrl(e.target.value)} />
            </div>
            <div>
              <label className="form-label mb-2 d-block">Footer Text</label>
              <input className="form-control" type="text" value={footerText} maxLength={2048}
                onChange={(e) => setFooterText(e.target.value)} />
            </div>
          </CollapsibleSection>

          <div className="card p-4 mb-4">
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Interaction Type</h3>
            {isSent && (
              <p style={{
                fontSize: 13, color: 'var(--warning-color, #FFB800)',
                background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.3)',
                borderRadius: 8, padding: '8px 12px',
              }}>
                This message has been sent — the interaction type can't be changed anymore.
              </p>
            )}
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {(['emoji', 'button', 'dropdown'] as const).map((t) => (
                <label key={t} className="d-flex align-items-center gap-2 m-0"
                  style={{ fontSize: 14, cursor: isSent && t !== interactionType ? 'default' : 'pointer', opacity: isSent && t !== interactionType ? 0.5 : 1 }}>
                  <input type="radio" className="form-check-input m-0" name="interactionType"
                    checked={interactionType === t}
                    disabled={isSent && t !== interactionType}
                    onChange={() => setInteractionType(t)} />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* Mapping editors */}
          {interactionType === 'emoji' && (
            <div className="card p-4 mb-4">
              <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Emoji → Role Mappings</h3>
              {emojiMappings.map((m, i) => (
                <div key={m.key} className="card p-3 mb-3" style={{ background: 'var(--bg-tertiary)' }}>
                  <MappingHeader label={`Emoji ${i + 1}`} onRemove={() => setEmojiMappings(emojiMappings.filter((_, j) => j !== i))} />
                  <div className="mb-2">
                    <label className="form-label mb-2 d-block">Emoji</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input className="form-control" type="text" placeholder="😀 or pick one" value={m.emoji}
                        onChange={(e) => setEmojiMappings(emojiMappings.map((x, j) => j === i ? { ...x, emoji: e.target.value } : x))} />
                      <button className="btn btn-sm" style={{ background: '#5865F2', color: '#fff', flexShrink: 0 }}
                        onClick={() => setEmojiTarget(() => (emoji: string) =>
                          setEmojiMappings((prev) => prev.map((x, j) => j === i ? { ...x, emoji } : x)))}>
                        Select
                      </button>
                      {m.emoji && <span style={{ fontSize: 20 }}><EmojiDisplay emoji={m.emoji} /></span>}
                    </div>
                  </div>
                  <RoleMultiSelect guildId={guildId!} label="Roles" value={m.roleIds}
                    onChange={(roleIds) => setEmojiMappings(emojiMappings.map((x, j) => j === i ? { ...x, roleIds } : x))} />
                </div>
              ))}
              <AddButton label="Add Emoji Mapping"
                onClick={() => setEmojiMappings([...emojiMappings, { key: crypto.randomUUID(), emoji: '', roleIds: [] }])} />
            </div>
          )}

          {interactionType === 'button' && (
            <div className="card p-4 mb-4">
              <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Buttons</h3>
              {buttons.map((b, i) => (
                <div key={b.key} className="card p-3 mb-3" style={{ background: 'var(--bg-tertiary)' }}>
                  <MappingHeader label={`Button ${i + 1}`} onRemove={() => setButtons(buttons.filter((_, j) => j !== i))} />
                  <div className="mb-2">
                    <label className="form-label mb-2 d-block">Label</label>
                    <input className="form-control" type="text" placeholder="Click me!" value={b.label}
                      onChange={(e) => setButtons(buttons.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label mb-2 d-block">Style</label>
                    <select className="form-control" value={b.style}
                      onChange={(e) => setButtons(buttons.map((x, j) => j === i ? { ...x, style: Number(e.target.value) } : x))}>
                      {BUTTON_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="form-label mb-2 d-block">Emoji (optional)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input className="form-control" type="text" placeholder="😀" value={b.emoji ?? ''}
                        onChange={(e) => setButtons(buttons.map((x, j) => j === i ? { ...x, emoji: e.target.value } : x))} />
                      <button className="btn btn-sm" style={{ background: '#5865F2', color: '#fff', flexShrink: 0 }}
                        onClick={() => setEmojiTarget(() => (emoji: string) =>
                          setButtons((prev) => prev.map((x, j) => j === i ? { ...x, emoji } : x)))}>
                        Select
                      </button>
                      {b.emoji && <span style={{ fontSize: 20 }}><EmojiDisplay emoji={b.emoji} /></span>}
                    </div>
                  </div>
                  <RoleMultiSelect guildId={guildId!} label="Roles" value={b.roleIds}
                    onChange={(roleIds) => setButtons(buttons.map((x, j) => j === i ? { ...x, roleIds } : x))} />
                </div>
              ))}
              <AddButton label="Add Button"
                onClick={() => setButtons([...buttons, { key: crypto.randomUUID(), label: '', style: 1, roleIds: [] }])} />
            </div>
          )}

          {interactionType === 'dropdown' && (
            <div className="card p-4 mb-4">
              <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Dropdown</h3>
              <div className="mb-3">
                <label className="form-label mb-2 d-block">Placeholder</label>
                <input className="form-control" type="text" placeholder="Select roles..." value={dropdownPlaceholder}
                  onChange={(e) => setDropdownPlaceholder(e.target.value)} />
              </div>
              {dropdownOptions.map((o, i) => (
                <div key={o.key} className="card p-3 mb-3" style={{ background: 'var(--bg-tertiary)' }}>
                  <MappingHeader label={`Option ${i + 1}`} onRemove={() => setDropdownOptions(dropdownOptions.filter((_, j) => j !== i))} />
                  <div className="mb-2">
                    <label className="form-label mb-2 d-block">Label</label>
                    <input className="form-control" type="text" placeholder="Option Label" value={o.label}
                      onChange={(e) => setDropdownOptions(dropdownOptions.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label mb-2 d-block">Description (optional)</label>
                    <input className="form-control" type="text" placeholder="Description..." value={o.description ?? ''}
                      onChange={(e) => setDropdownOptions(dropdownOptions.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label mb-2 d-block">Emoji (optional)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input className="form-control" type="text" placeholder="😀" value={o.emoji ?? ''}
                        onChange={(e) => setDropdownOptions(dropdownOptions.map((x, j) => j === i ? { ...x, emoji: e.target.value } : x))} />
                      <button className="btn btn-sm" style={{ background: '#5865F2', color: '#fff', flexShrink: 0 }}
                        onClick={() => setEmojiTarget(() => (emoji: string) =>
                          setDropdownOptions((prev) => prev.map((x, j) => j === i ? { ...x, emoji } : x)))}>
                        Select
                      </button>
                      {o.emoji && <span style={{ fontSize: 20 }}><EmojiDisplay emoji={o.emoji} /></span>}
                    </div>
                  </div>
                  <RoleMultiSelect guildId={guildId!} label="Roles" value={o.roleIds}
                    onChange={(roleIds) => setDropdownOptions(dropdownOptions.map((x, j) => j === i ? { ...x, roleIds } : x))} />
                </div>
              ))}
              <AddButton label="Add Option"
                onClick={() => setDropdownOptions([...dropdownOptions, { key: crypto.randomUUID(), label: '', roleIds: [] }])} />
            </div>
          )}

          <label className="d-flex align-items-center gap-2 mb-3" style={{ fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" className="form-check-input m-0" checked={suppressRolePings}
              onChange={(e) => setSuppressRolePings(e.target.checked)} />
            Suppress role pings when sending
          </label>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {isSent ? (
              <button className="btn primary" disabled={saving} onClick={updateMessage}>
                {saving ? 'Working…' : 'Update Message'}
              </button>
            ) : (
              <>
                <button className="btn primary" disabled={saving} onClick={sendToDiscord}>
                  {saving ? 'Working…' : 'Send to Discord'}
                </button>
                <button className="btn" disabled={saving} onClick={saveDraft}
                  style={{ border: '1px solid var(--border-cyan)', color: 'var(--primary-color)', background: 'transparent' }}>
                  Save Draft
                </button>
              </>
            )}
            <button className="btn" disabled={saving} onClick={() => navigate(`/server/${guildId}/reaction-roles`)}>
              Cancel
            </button>
          </div>
        </div>

        {/* Right — live preview */}
        <div style={{ position: 'sticky', top: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>Live Preview</h3>
          <RRPreview
            textContent={messageText}
            embedConfig={(embedTitle || embedDescription) ? {
              title: embedTitle, description: embedDescription, color: embedColor,
              thumbnail: thumbnailUrl, image: imageUrl, footer: footerText,
            } : null}
            interactionType={interactionType}
            emojiMappings={validEmojiMappings()}
            buttonConfigs={validButtons()}
            dropdownConfig={{ placeholder: dropdownPlaceholder, options: validDropdownOptions() }}
          />
        </div>
      </div>

      <EmojiPicker
        open={emojiTarget !== null}
        onClose={() => setEmojiTarget(null)}
        onSelect={(emoji) => { emojiTarget?.(emoji); setEmojiTarget(null); }}
        serverEmojis={serverEmojis}
        usedEmojis={[]}
      />
    </div>
  );
};

const MappingHeader: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
    <button onClick={onRemove}
      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
      <X size={16} />
    </button>
  </div>
);

const AddButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button className="btn btn-sm" onClick={onClick}
    style={{ border: '1px solid var(--border-light)', color: 'var(--text-primary)', background: 'transparent' }}>
    <Plus size={14} style={{ verticalAlign: '-0.125em' }} /> {label}
  </button>
);
