import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCustomCommands, CustomCommand } from './useCustomCommands';
import { LoadingSpinner, SaveBar } from '@/components/ui';

export const CustomCommandsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { commands, maxCommands, isLoading, addCommand, isAdding, deleteCommand } = useCustomCommands(guildId!);
  const [showForm, setShowForm] = useState(false);
  const [newCommand, setNewCommand] = useState<Partial<CustomCommand>>({
    trigger: '',
    response_type: 'text',
    response_content: ''
  });

  if (isLoading) return <LoadingSpinner />;

  const handleSave = () => {
    if (!newCommand.trigger || !newCommand.response_content) return;
    addCommand(newCommand, {
      onSuccess: () => {
        setShowForm(false);
        setNewCommand({ trigger: '', response_type: 'text', response_content: '' });
      }
    });
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
          <div className="mb-3">
            <label className="form-label mb-2 d-block">Trigger (ex: !rules)</label>
            <input 
              type="text" 
              className="form-control" 
              value={newCommand.trigger} 
              onChange={(e) => setNewCommand({ ...newCommand, trigger: e.target.value })}
              placeholder="Enter trigger..."
            />
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
              value={newCommand.response_content} 
              onChange={(e) => setNewCommand({ ...newCommand, response_content: e.target.value })}
              placeholder="Enter what the bot should say..."
            />
          </div>
          <div className="d-flex justify-content-end gap-3">
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button 
              className="btn primary" 
              onClick={handleSave}
              disabled={isAdding || !newCommand.trigger || !newCommand.response_content}
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
                  {commands.map((cmd: CustomCommand) => (
                    <tr key={cmd.id}>
                      <td className="p-3 align-middle fw-bold text-primary">{cmd.trigger}</td>
                      <td className="p-3 align-middle">
                        <span className="badge bg-tertiary text-muted">{cmd.response_type}</span>
                      </td>
                      <td className="p-3 align-middle">
                        <div className="text-truncate" style={{ maxWidth: '300px' }}>
                          {cmd.response_content}
                        </div>
                      </td>
                      <td className="p-3 align-middle text-end">
                        <button 
                          className="btn btn-sm btn-outline-danger p-1" 
                          onClick={() => { if (confirm('Delete this command?')) deleteCommand(cmd.id); }}
                          style={{ minWidth: '32px' }}
                        >
                          ×
                        </button>
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
