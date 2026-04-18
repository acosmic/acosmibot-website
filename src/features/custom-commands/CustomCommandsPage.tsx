import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useCustomCommands, CustomCommand, CommandPayload, EmbedConfig } from './useCustomCommands';
import { LoadingSpinner } from '@/components/ui';

// ── helpers ──────────────────────────────────────────────────────────────────

function intToHex(n: number | null | undefined): string {
  if (n == null) return '#5865F2';
  return '#' + n.toString(16).padStart(6, '0');
}

function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function embedPreview(cfg: EmbedConfig | null | undefined): string {
  return cfg?.title || cfg?.description || 'Rich Embed';
}

const VARIABLES = ['{user}', '{server}', '{channel}', '{uses}'];

// ── form state ────────────────────────────────────────────────────────────────

interface FormState {
  command: string;
  prefix: string;
  response_type: 'text' | 'embed';
  response_text: string;
  // flattened embed fields for easier binding
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_thumbnail: string;
  embed_image: string;
  embed_footer: string;
}

function emptyForm(): FormState {
  return {
    command: '',
    prefix: '!',
    response_type: 'text',
    response_text: '',
    embed_title: '',
    embed_description: '',
    embed_color: '#5865F2',
    embed_thumbnail: '',
    embed_image: '',
    embed_footer: '',
  };
}

function formFromCommand(cmd: CustomCommand): FormState {
  return {
    command: cmd.command,
    prefix: cmd.prefix,
    response_type: cmd.response_type,
    response_text: cmd.response_text ?? '',
    embed_title: cmd.embed_config?.title ?? '',
    embed_description: cmd.embed_config?.description ?? '',
    embed_color: intToHex(cmd.embed_config?.color),
    embed_thumbnail: cmd.embed_config?.thumbnail?.url ?? '',
    embed_image: cmd.embed_config?.image?.url ?? '',
    embed_footer: cmd.embed_config?.footer?.text ?? '',
  };
}

function buildPayload(form: FormState): CommandPayload {
  const base = { command: form.command.trim(), prefix: form.prefix, response_type: form.response_type };
  if (form.response_type === 'text') {
    return { ...base, response_text: form.response_text };
  }
  const cfg: EmbedConfig = {
    title: form.embed_title.trim() || null,
    description: form.embed_description.trim() || null,
    color: hexToInt(form.embed_color),
  };
  if (form.embed_thumbnail.trim()) cfg.thumbnail = { url: form.embed_thumbnail.trim() };
  if (form.embed_image.trim()) cfg.image = { url: form.embed_image.trim() };
  if (form.embed_footer.trim()) cfg.footer = { text: form.embed_footer.trim() };
  return { ...base, embed_config: cfg };
}

// ── component ─────────────────────────────────────────────────────────────────

export const CustomCommandsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { commands, maxCommands, isLoading, addCommand, isAdding, updateCommand, isUpdating, deleteCommand } =
    useCustomCommands(guildId!);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null); // null = create mode
  const [showForm, setShowForm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  if (isLoading) return <LoadingSpinner />;

  const isSaving = isAdding || isUpdating;

  // ── form helpers ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const openEdit = (cmd: CustomCommand) => {
    setEditingId(cmd.id);
    setForm(formFromCommand(cmd));
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const set = (key: keyof FormState, value: string) => setForm(f => ({ ...f, [key]: value }));

  const insertVariable = (variable: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const next = ta.value.substring(0, start) + variable + ta.value.substring(end);
    set('response_text', next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + variable.length;
    });
  };

  const validate = (): string | null => {
    if (!form.command.trim()) return 'Command name is required.';
    if (!/^[a-zA-Z0-9_-]+$/.test(form.command.trim())) return 'Command name can only contain letters, numbers, hyphens, and underscores.';
    if (form.response_type === 'text' && !form.response_text.trim()) return 'Response text is required.';
    if (form.response_type === 'embed' && !form.embed_title.trim() && !form.embed_description.trim()) return 'Embed must have at least a title or description.';
    return null;
  };

  const handleSave = () => {
    const err = validate();
    if (err) { alert(err); return; }
    const payload = buildPayload(form);
    if (editingId) {
      updateCommand({ commandId: editingId, data: payload }, { onSuccess: closeForm });
    } else {
      addCommand(payload, { onSuccess: closeForm });
    }
  };

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="feature-page">
      {/* Header */}
      <div className="page-header d-flex justify-content-between align-items-center mb-4">
        <div className="text-start">
          <h1>Custom Commands</h1>
          <p>Create server-specific commands and automated responses.</p>
        </div>
        <button
          className="btn primary py-2 px-4"
          onClick={showForm && !editingId ? closeForm : openCreate}
          disabled={!showForm && commands.length >= maxCommands}
        >
          {showForm && !editingId ? 'Cancel' : 'Add Command'}
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div ref={formRef} className="card p-4 mb-4 border-primary fade-in">
          <h3 className="mb-4">{editingId ? 'Edit Command' : 'New Command'}</h3>

          {/* Prefix + Command */}
          <div className="d-flex gap-3 mb-3">
            <div style={{ width: '80px', flexShrink: 0 }}>
              <label className="form-label mb-2 d-block">Prefix</label>
              <input
                type="text"
                className="form-control"
                value={form.prefix}
                onChange={e => set('prefix', e.target.value)}
              />
            </div>
            <div className="flex-grow-1">
              <label className="form-label mb-2 d-block">Command Name</label>
              <input
                type="text"
                className="form-control"
                value={form.command}
                onChange={e => set('command', e.target.value)}
                placeholder="e.g. rules"
              />
            </div>
          </div>

          {/* Live preview */}
          <div className="mb-3" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Preview: <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
              {form.prefix}{form.command || 'command'}
            </span>
          </div>

          {/* Response type toggle */}
          <div className="mb-3">
            <label className="form-label mb-2 d-block">Response Type</label>
            <div className="d-flex gap-2">
              {(['text', 'embed'] as const).map(t => (
                <button
                  key={t}
                  className={`btn btn-sm ${form.response_type === t ? 'primary' : 'btn-outline-secondary'}`}
                  style={{ minWidth: '80px' }}
                  onClick={() => set('response_type', t)}
                >
                  {t === 'text' ? 'Plain Text' : 'Embed'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Text section ─────────────────────────────────── */}
          {form.response_type === 'text' && (
            <div className="mb-4">
              <label className="form-label mb-2 d-block">Response Text</label>
              <div className="d-flex flex-wrap gap-1 mb-2">
                {VARIABLES.map(v => (
                  <button
                    key={v}
                    className="btn btn-sm"
                    style={{ fontSize: '12px', padding: '2px 8px', background: 'var(--bg-overlay)', color: 'var(--text-secondary)' }}
                    onClick={() => insertVariable(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                className="form-control"
                rows={4}
                value={form.response_text}
                onChange={e => set('response_text', e.target.value)}
                placeholder="Enter what the bot should say..."
              />
            </div>
          )}

          {/* ── Embed section ─────────────────────────────────── */}
          {form.response_type === 'embed' && (
            <div className="mb-4">
              <div className="card p-3" style={{ background: 'var(--bg-overlay)', borderRadius: '8px' }}>
                {/* Accent preview bar */}
                <div style={{ height: '4px', borderRadius: '2px', background: form.embed_color, marginBottom: '12px' }} />

                <div className="mb-3">
                  <label className="form-label mb-2 d-block">Title</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.embed_title}
                    onChange={e => set('embed_title', e.target.value)}
                    placeholder="Embed title..."
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label mb-2 d-block">Description</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={form.embed_description}
                    onChange={e => set('embed_description', e.target.value)}
                    placeholder="Embed description..."
                  />
                </div>

                <div className="d-flex gap-3 mb-3">
                  <div>
                    <label className="form-label mb-2 d-block">Color</label>
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="color"
                        value={form.embed_color}
                        onChange={e => set('embed_color', e.target.value)}
                        style={{ width: '40px', height: '36px', padding: '2px', background: 'none', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        className="form-control"
                        value={form.embed_color}
                        onChange={e => set('embed_color', e.target.value)}
                        style={{ width: '100px' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label mb-2 d-block">Thumbnail URL <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.embed_thumbnail}
                    onChange={e => set('embed_thumbnail', e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label mb-2 d-block">Image URL <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.embed_image}
                    onChange={e => set('embed_image', e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="mb-0">
                  <label className="form-label mb-2 d-block">Footer <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.embed_footer}
                    onChange={e => set('embed_footer', e.target.value)}
                    placeholder="Footer text..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="d-flex justify-content-end gap-3">
            <button className="btn" onClick={closeForm}>Cancel</button>
            <button className="btn primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Command'}
            </button>
          </div>
        </div>
      )}

      {/* Commands table */}
      <div className="card p-0 overflow-hidden">
        <div className="card-header bg-tertiary p-3 border-bottom border-light">
          <div className="d-flex justify-content-between align-items-center">
            <h3 className="mb-0 fs-5">Existing Commands</h3>
            <span className="badge bg-secondary">{commands.length} / {maxCommands}</span>
          </div>
        </div>
        <div className="card-body p-0">
          {commands.length === 0 ? (
            <div className="text-center p-5 text-muted">
              No custom commands yet. Click "Add Command" to create one.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-dark table-hover mb-0" style={{ background: 'transparent' }}>
                <thead>
                  <tr>
                    <th className="p-3 border-light">Trigger</th>
                    <th className="p-3 border-light">Type</th>
                    <th className="p-3 border-light">Response Preview</th>
                    <th className="p-3 border-light text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {commands.map(cmd => (
                    <tr key={cmd.id} className={editingId === cmd.id ? 'table-active' : ''}>
                      <td className="p-3 align-middle fw-bold text-primary">
                        {cmd.prefix}{cmd.command}
                      </td>
                      <td className="p-3 align-middle">
                        <span className="badge bg-tertiary text-muted">{cmd.response_type}</span>
                      </td>
                      <td className="p-3 align-middle">
                        <div className="text-truncate" style={{ maxWidth: '300px' }}>
                          {cmd.response_type === 'embed'
                            ? embedPreview(cmd.embed_config)
                            : cmd.response_text}
                        </div>
                      </td>
                      <td className="p-3 align-middle text-end">
                        <div className="d-flex gap-2 justify-content-end">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            style={{ minWidth: '50px' }}
                            onClick={() => editingId === cmd.id ? closeForm() : openEdit(cmd)}
                          >
                            {editingId === cmd.id ? 'Cancel' : 'Edit'}
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger p-1"
                            style={{ minWidth: '32px' }}
                            onClick={() => { if (confirm('Delete this command?')) deleteCommand(cmd.id); }}
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
