import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCustomCommands, CustomCommand } from './useCustomCommands';
import { LoadingSpinner } from '@/components/ui';

interface NewCommandForm {
  command: string;
  prefix: string;
  response_type: 'text' | 'embed';
  response_text: string;
}

const emptyForm = (): NewCommandForm => ({
  command: '',
  prefix: '!',
  response_type: 'text',
  response_text: '',
});

export const CustomCommandsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { commands, maxCommands, isLoading, addCommand, isAdding, updateCommand, isUpdating, deleteCommand } =
    useCustomCommands(guildId!);

  const [showForm, setShowForm] = useState(false);
  const [newCommand, setNewCommand] = useState<NewCommandForm>(emptyForm());

  // Edit state: which command id is being edited, and its draft values
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<CustomCommand>>({});

  if (isLoading) return <LoadingSpinner />;

  const handleSave = () => {
    if (!newCommand.command || !newCommand.response_text) return;
    addCommand(
      { command: newCommand.command, prefix: newCommand.prefix, response_type: newCommand.response_type, response_text: newCommand.response_text },
      {
        onSuccess: () => {
          setShowForm(false);
          setNewCommand(emptyForm());
        },
      }
    );
  };

  const handleEditStart = (cmd: CustomCommand) => {
    setEditingId(cmd.id);
    setEditDraft({ command: cmd.command, prefix: cmd.prefix, response_type: cmd.response_type, response_text: cmd.response_text });
  };

  const handleEditSave = (cmdId: string) => {
    updateCommand(
      { commandId: cmdId, data: editDraft },
      { onSuccess: () => setEditingId(null) }
    );
  };

  return (
    <div className="feature-page">
      <div className="page-header d-flex justify-content-between align-items-center mb-4">
        <div className="text-start">
          <h1>Custom Commands</h1>
          <p>Create server-specific commands and automated responses.</p>
        </div>
        <button
          className="btn primary py-2 px-4"
          onClick={() => setShowForm(!showForm)}
          disabled={commands.length >= maxCommands}
        >
          {showForm ? 'Cancel' : 'Add Command'}
        </button>
      </div>

      {showForm && (
        <div className="card p-4 mb-4 border-primary fade-in">
          <h3 className="mb-4">New Command</h3>
          <div className="row mb-3">
            <div className="col-3">
              <label className="form-label mb-2 d-block">Prefix</label>
              <input
                type="text"
                className="form-control"
                value={newCommand.prefix}
                onChange={(e) => setNewCommand({ ...newCommand, prefix: e.target.value })}
                placeholder="!"
                style={{ maxWidth: '80px' }}
              />
            </div>
            <div className="col-9">
              <label className="form-label mb-2 d-block">Command (ex: rules)</label>
              <input
                type="text"
                className="form-control"
                value={newCommand.command}
                onChange={(e) => setNewCommand({ ...newCommand, command: e.target.value })}
                placeholder="Enter command name..."
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label mb-2 d-block">Response Type</label>
            <select
              className="form-control"
              value={newCommand.response_type}
              onChange={(e) => setNewCommand({ ...newCommand, response_type: e.target.value as 'text' | 'embed' })}
            >
              <option value="text">Plain Text</option>
              <option value="embed">Embed (Rich Content)</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="form-label mb-2 d-block">Response Content</label>
            <textarea
              className="form-control"
              rows={4}
              value={newCommand.response_text}
              onChange={(e) => setNewCommand({ ...newCommand, response_text: e.target.value })}
              placeholder="Enter what the bot should say..."
            />
          </div>
          <div className="d-flex justify-content-end gap-3">
            <button className="btn" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={handleSave}
              disabled={isAdding || !newCommand.command || !newCommand.response_text}
            >
              {isAdding ? 'Creating...' : 'Create Command'}
            </button>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="card-header bg-tertiary p-3 border-bottom border-light">
          <div className="d-flex justify-content-between align-items-center">
            <h3 className="mb-0 fs-5">Existing Commands</h3>
            <span className="badge bg-secondary">
              {commands.length} / {maxCommands}
            </span>
          </div>
        </div>
        <div className="card-body p-0">
          {commands.length === 0 ? (
            <div className="text-center p-5 text-muted">
              No custom commands found. Click "Add Command" to create one.
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
                  {commands.map((cmd: CustomCommand) =>
                    editingId === cmd.id ? (
                      <tr key={cmd.id}>
                        <td className="p-3 align-top">
                          <div className="d-flex gap-1">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              style={{ width: '50px' }}
                              value={editDraft.prefix ?? cmd.prefix}
                              onChange={(e) => setEditDraft({ ...editDraft, prefix: e.target.value })}
                            />
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              value={editDraft.command ?? cmd.command}
                              onChange={(e) => setEditDraft({ ...editDraft, command: e.target.value })}
                            />
                          </div>
                        </td>
                        <td className="p-3 align-top">
                          <select
                            className="form-control form-control-sm"
                            value={editDraft.response_type ?? cmd.response_type}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, response_type: e.target.value as 'text' | 'embed' })
                            }
                          >
                            <option value="text">text</option>
                            <option value="embed">embed</option>
                          </select>
                        </td>
                        <td className="p-3 align-top">
                          <textarea
                            className="form-control form-control-sm"
                            rows={3}
                            value={editDraft.response_text ?? cmd.response_text}
                            onChange={(e) => setEditDraft({ ...editDraft, response_text: e.target.value })}
                          />
                        </td>
                        <td className="p-3 align-top text-end">
                          <div className="d-flex gap-2 justify-content-end">
                            <button
                              className="btn btn-sm btn-outline-success px-2"
                              onClick={() => handleEditSave(cmd.id)}
                              disabled={isUpdating}
                            >
                              {isUpdating ? '...' : 'Save'}
                            </button>
                            <button
                              className="btn btn-sm btn-outline-secondary px-2"
                              onClick={() => setEditingId(null)}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={cmd.id}>
                        <td className="p-3 align-middle fw-bold text-primary">
                          {cmd.prefix}{cmd.command}
                        </td>
                        <td className="p-3 align-middle">
                          <span className="badge bg-tertiary text-muted">{cmd.response_type}</span>
                        </td>
                        <td className="p-3 align-middle">
                          <div className="text-truncate" style={{ maxWidth: '300px' }}>
                            {cmd.response_text}
                          </div>
                        </td>
                        <td className="p-3 align-middle text-end">
                          <div className="d-flex gap-2 justify-content-end">
                            <button
                              className="btn btn-sm btn-outline-primary px-2"
                              onClick={() => handleEditStart(cmd)}
                              style={{ minWidth: '50px' }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger p-1"
                              onClick={() => { if (confirm('Delete this command?')) deleteCommand(cmd.id); }}
                              style={{ minWidth: '32px' }}
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
