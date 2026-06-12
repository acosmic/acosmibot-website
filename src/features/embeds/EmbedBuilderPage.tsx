import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload, X } from 'lucide-react';
import { CollapsibleSection, LoadingSpinner } from '@/components/ui';
import {
  DiscordEmbedPreview, validateEmbed,
  type EmbedButton, type EmbedConfig, type EmbedField,
} from '@/components/ui/DiscordEmbedPreview';
import { embedsApi, type EmbedPayload, type UploadImageType } from '@/api/embeds';
import { useGuildChannels } from '@/hooks/useGuildChannels';
import { showToast } from '@/utils/toast';

interface FieldDraft extends EmbedField { key: string }
interface ButtonDraft extends EmbedButton { key: string }

const DEFAULT_COLOR = '#00D9FF';

const hexToInt = (hex: string): number => parseInt(hex.replace('#', ''), 16);
const intToHex = (color?: number): string =>
  color !== undefined && color !== null ? `#${color.toString(16).padStart(6, '0')}` : DEFAULT_COLOR;

export const EmbedBuilderPage: React.FC = () => {
  const { guildId, embedId } = useParams<{ guildId: string; embedId?: string }>();
  const navigate = useNavigate();
  const isEditing = !!embedId;

  const { data: channels = [] } = useGuildChannels(guildId!);
  const textChannels = channels.filter((c) => c.type === 0);

  const existingQuery = useQuery({
    queryKey: ['guild', guildId, 'embeds', embedId],
    queryFn: () => embedsApi.get(guildId!, embedId!),
    enabled: isEditing,
  });

  // Form state
  const [name, setName] = useState('');
  const [messageText, setMessageText] = useState('');
  const [channelId, setChannelId] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorUrl, setAuthorUrl] = useState('');
  const [authorIcon, setAuthorIcon] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [footerText, setFooterText] = useState('');
  const [footerIcon, setFooterIcon] = useState('');
  const [includeTimestamp, setIncludeTimestamp] = useState(false);
  const [buttons, setButtons] = useState<ButtonDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Image upload plumbing
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadTypeRef = useRef<UploadImageType | null>(null);

  useEffect(() => {
    const embed = existingQuery.data;
    if (!embed || seeded) return;
    setSeeded(true);
    setName(embed.name ?? '');
    setMessageText(embed.message_text ?? '');
    setChannelId(embed.channel_id ?? '');
    const cfg = embed.embed_config ?? {};
    setAuthorName(cfg.author?.name ?? '');
    setAuthorUrl(cfg.author?.url ?? '');
    setAuthorIcon(cfg.author?.icon_url ?? '');
    setTitle(cfg.title ?? '');
    setDescription(cfg.description ?? '');
    setUrl(cfg.url ?? '');
    setColor(intToHex(cfg.color));
    setThumbnailUrl(cfg.thumbnail?.url ?? '');
    setImageUrl(cfg.image?.url ?? '');
    setFields((cfg.fields ?? []).map((f) => ({ ...f, key: crypto.randomUUID() })));
    setFooterText(cfg.footer?.text ?? '');
    setFooterIcon(cfg.footer?.icon_url ?? '');
    setIncludeTimestamp(!!cfg.timestamp);
    setButtons((embed.buttons ?? []).map((b) => ({ ...b, key: crypto.randomUUID() })));
  }, [existingQuery.data, seeded]);

  if (isEditing && existingQuery.isLoading) return <LoadingSpinner />;
  if (isEditing && existingQuery.isError) {
    return (
      <div className="card p-4">
        Failed to load this embed.{' '}
        <button className="btn btn-sm" onClick={() => navigate(`/server/${guildId}/embeds`)}>Back to list</button>
      </div>
    );
  }

  const buildConfig = (): EmbedConfig => {
    const cfg: EmbedConfig = {};
    if (authorName) {
      cfg.author = { name: authorName, url: authorUrl || undefined, icon_url: authorIcon || undefined };
    }
    cfg.title = title || undefined;
    cfg.description = description || undefined;
    cfg.url = url || undefined;
    cfg.color = hexToInt(color);
    if (thumbnailUrl) cfg.thumbnail = { url: thumbnailUrl };
    if (imageUrl) cfg.image = { url: imageUrl };
    const validFields = fields.filter((f) => f.name && f.value).map(({ key: _key, ...f }) => f);
    if (validFields.length > 0) cfg.fields = validFields;
    if (footerText) cfg.footer = { text: footerText, icon_url: footerIcon || undefined };
    if (includeTimestamp) cfg.timestamp = true;
    return cfg;
  };

  const buildPayload = (): EmbedPayload => ({
    name,
    message_text: messageText,
    channel_id: channelId || null,
    embed_config: buildConfig(),
    buttons: buttons.filter((b) => b.label && b.url).map(({ key: _key, ...b }) => b),
  });

  const validate = (requireChannel: boolean): boolean => {
    if (!name.trim()) {
      showToast('Please enter an embed name', 'error');
      return false;
    }
    const cfg = buildConfig();
    if (!cfg.title && !cfg.description) {
      showToast('Embed must have at least a title or description', 'error');
      return false;
    }
    if (requireChannel && !channelId) {
      showToast('Please select a target channel', 'error');
      return false;
    }
    const errors = validateEmbed(cfg);
    if (errors.length > 0) {
      showToast(errors[0], 'error');
      return false;
    }
    return true;
  };

  const saveDraft = async () => {
    if (!validate(false)) return;
    setSaving(true);
    try {
      if (isEditing) {
        await embedsApi.update(guildId!, embedId!, buildPayload());
        showToast('Embed updated!', 'success');
      } else {
        await embedsApi.create(guildId!, buildPayload());
        showToast('Embed saved!', 'success');
      }
      navigate(`/server/${guildId}/embeds`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save embed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendEmbed = async () => {
    if (!validate(true)) return;
    setSaving(true);
    try {
      let id: string | number | undefined = embedId;
      if (isEditing) {
        await embedsApi.update(guildId!, embedId!, buildPayload());
      } else {
        const created = await embedsApi.create(guildId!, buildPayload());
        id = created.id;
      }
      await embedsApi.send(guildId!, id!);
      showToast('Embed sent to Discord!', 'success');
      navigate(`/server/${guildId}/embeds`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to send embed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startUpload = (type: UploadImageType) => {
    uploadTypeRef.current = type;
    uploadInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const type = uploadTypeRef.current;
    e.target.value = '';
    if (!file || !type) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast('Invalid file type', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('File too large (max 8MB)', 'error');
      return;
    }

    try {
      showToast('Uploading…', 'info');
      const uploadedUrl = await embedsApi.uploadImage(guildId!, file, type);
      const setterMap: Record<UploadImageType, (v: string) => void> = {
        author_icon: setAuthorIcon,
        footer_icon: setFooterIcon,
        thumbnail: setThumbnailUrl,
        image: setImageUrl,
      };
      setterMap[type](uploadedUrl);
      showToast('Image uploaded!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload image', 'error');
    }
  };

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>{isEditing ? 'Edit Embed' : 'Create Embed'}</h1>
        <p>Build the embed on the left — the live preview updates as you type.</p>
      </div>

      <input ref={uploadInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        {/* Left — form */}
        <div>
          <div className="card p-4 mb-4">
            <div className="mb-3">
              <label className="form-label mb-2 d-block">Embed Name *</label>
              <input className="form-control" type="text" value={name}
                placeholder="Internal name (not shown in Discord)"
                onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label mb-2 d-block">Message Text</label>
              <textarea className="form-control" rows={2} value={messageText}
                placeholder="Plain text sent above the embed (optional)"
                onChange={(e) => setMessageText(e.target.value)} />
            </div>
            <div>
              <label className="form-label mb-2 d-block">Target Channel</label>
              <select className="form-control" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                <option value="">Select a channel...</option>
                {textChannels.map((c) => <option key={c.id} value={c.id}># {c.name}</option>)}
              </select>
            </div>
          </div>

          <CollapsibleSection title="Author" defaultOpen={!!authorName}>
            <TextRow label="Author Name" value={authorName} onChange={setAuthorName} maxLength={256} />
            <TextRow label="Author URL" value={authorUrl} onChange={setAuthorUrl} placeholder="https://..." />
            <ImageUrlRow label="Author Icon" value={authorIcon} onChange={setAuthorIcon} onUpload={() => startUpload('author_icon')} />
          </CollapsibleSection>

          <CollapsibleSection title="Content" defaultOpen>
            <TextRow label="Title" value={title} onChange={setTitle} maxLength={256} />
            <div className="mb-3">
              <label className="form-label mb-2 d-block">Description</label>
              <textarea className="form-control" rows={4} value={description} maxLength={4096}
                onChange={(e) => setDescription(e.target.value)} />
            </div>
            <TextRow label="Title URL" value={url} onChange={setUrl} placeholder="https://..." />
            <div className="mb-3">
              <label className="form-label mb-2 d-block">Color</label>
              <input type="color" className="form-control form-control-color" value={color}
                onChange={(e) => setColor(e.target.value)} />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Images" defaultOpen={!!(thumbnailUrl || imageUrl)}>
            <ImageUrlRow label="Thumbnail (small, top-right)" value={thumbnailUrl} onChange={setThumbnailUrl} onUpload={() => startUpload('thumbnail')} />
            <ImageUrlRow label="Image (large, below content)" value={imageUrl} onChange={setImageUrl} onUpload={() => startUpload('image')} />
          </CollapsibleSection>

          <CollapsibleSection title={`Fields (${fields.length})`} defaultOpen={fields.length > 0}>
            {fields.map((f, i) => (
              <div key={f.key} className="card p-3 mb-3" style={{ background: 'var(--bg-tertiary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label className="d-flex align-items-center gap-2 m-0" style={{ fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" className="form-check-input m-0" checked={!!f.inline}
                      onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, inline: e.target.checked } : x))} />
                    Inline
                  </label>
                  <button onClick={() => setFields(fields.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                    <X size={16} />
                  </button>
                </div>
                <input className="form-control mb-2" type="text" placeholder="Field name" maxLength={256} value={f.name}
                  onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <textarea className="form-control" rows={2} placeholder="Field value" maxLength={1024} value={f.value}
                  onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
              </div>
            ))}
            <button className="btn btn-sm"
              style={{ border: '1px solid var(--border-light)', color: 'var(--text-primary)', background: 'transparent' }}
              onClick={() => setFields([...fields, { key: crypto.randomUUID(), name: '', value: '', inline: false }])}>
              <Plus size={14} style={{ verticalAlign: '-0.125em' }} /> Add Field
            </button>
          </CollapsibleSection>

          <CollapsibleSection title="Footer" defaultOpen={!!footerText}>
            <TextRow label="Footer Text" value={footerText} onChange={setFooterText} maxLength={2048} />
            <ImageUrlRow label="Footer Icon" value={footerIcon} onChange={setFooterIcon} onUpload={() => startUpload('footer_icon')} />
            <label className="d-flex align-items-center gap-2 m-0" style={{ fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" className="form-check-input m-0" checked={includeTimestamp}
                onChange={(e) => setIncludeTimestamp(e.target.checked)} />
              Include timestamp
            </label>
          </CollapsibleSection>

          <CollapsibleSection title={`Link Buttons (${buttons.length}/25)`} defaultOpen={buttons.length > 0}>
            {buttons.map((b, i) => (
              <div key={b.key} className="card p-3 mb-3" style={{ background: 'var(--bg-tertiary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Button {i + 1}</span>
                  <button onClick={() => setButtons(buttons.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                    <X size={16} />
                  </button>
                </div>
                <input className="form-control mb-2" type="text" placeholder="Click here!" maxLength={80} value={b.label}
                  onChange={(e) => setButtons(buttons.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <input className="form-control mb-2" type="url" placeholder="https://example.com (HTTPS required)" value={b.url}
                  onChange={(e) => setButtons(buttons.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
                <input className="form-control" type="text" placeholder="Emoji (optional)" maxLength={2} value={b.emoji ?? ''}
                  onChange={(e) => setButtons(buttons.map((x, j) => j === i ? { ...x, emoji: e.target.value } : x))} />
              </div>
            ))}
            <button className="btn btn-sm" disabled={buttons.length >= 25}
              style={{ border: '1px solid var(--border-light)', color: 'var(--text-primary)', background: 'transparent' }}
              onClick={() => setButtons([...buttons, { key: crypto.randomUUID(), label: '', url: '' }])}>
              <Plus size={14} style={{ verticalAlign: '-0.125em' }} /> Add Button
            </button>
          </CollapsibleSection>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn primary" disabled={saving} onClick={sendEmbed}>
              {saving ? 'Working…' : 'Send to Discord'}
            </button>
            <button className="btn" disabled={saving} onClick={saveDraft}
              style={{ border: '1px solid var(--border-cyan)', color: 'var(--primary-color)', background: 'transparent' }}>
              Save Draft
            </button>
            <button className="btn" disabled={saving} onClick={() => navigate(`/server/${guildId}/embeds`)}>
              Cancel
            </button>
          </div>
        </div>

        {/* Right — live preview */}
        <div style={{ position: 'sticky', top: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>Live Preview</h3>
          <DiscordEmbedPreview
            config={buildConfig()}
            buttons={buttons}
            messageText={messageText}
          />
        </div>
      </div>
    </div>
  );
};

const TextRow: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; maxLength?: number;
}> = ({ label, value, onChange, placeholder, maxLength }) => (
  <div className="mb-3">
    <label className="form-label mb-2 d-block">{label}</label>
    <input className="form-control" type="text" value={value} placeholder={placeholder}
      maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const ImageUrlRow: React.FC<{
  label: string; value: string; onChange: (v: string) => void; onUpload: () => void;
}> = ({ label, value, onChange, onUpload }) => (
  <div className="mb-3">
    <label className="form-label mb-2 d-block">{label}</label>
    <div style={{ display: 'flex', gap: 8 }}>
      <input className="form-control" type="url" value={value} placeholder="https://... or upload"
        onChange={(e) => onChange(e.target.value)} />
      <button className="btn" onClick={onUpload} title="Upload image"
        style={{ border: '1px solid var(--border-light)', color: 'var(--text-primary)', background: 'transparent', flexShrink: 0 }}>
        <Upload size={15} />
      </button>
    </div>
    {value && (
      <img src={value} alt="" style={{ marginTop: 8, maxHeight: 60, borderRadius: 6, display: 'block' }} />
    )}
  </div>
);
