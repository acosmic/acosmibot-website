/** Custom tab: the channel's own commands with search, an enable switch per row and the editor drawer. */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import type { SectionProps } from '../types';
import {
  EmptyState, Field, RecordTable, StatusChip, Switch, twitchRetry, useChannelMutation, useLevelLabel,
} from '../shared/ui';
import { commandsApi } from './api';
import { CommandEditor } from './CommandEditor';
import { commandsKey } from './hooks';
import { COMMAND_LIMITS, cooldownSummary, filterCommands, shorten, type Command } from './model';

export const CustomCommandsTab: React.FC<SectionProps> = ({ channelId }) => {
  const levelLabel = useLevelLabel();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Command | 'new' | null>(null);
  const list = useQuery({ queryKey: commandsKey(channelId), queryFn: () => commandsApi.list(channelId), retry: twitchRetry });
  const toggle = useChannelMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => commandsApi.setEnabled(channelId, id, enabled),
    invalidate: [commandsKey(channelId)],
    errorMessage: 'The command could not be changed.',
  });

  if (list.isError) {
    return (
      <LoadFailed
        title="Custom commands didn't load"
        message={`${list.error instanceof Error ? list.error.message : 'Something went wrong.'} Nothing was changed.`}
        onRetry={() => list.refetch()}
      />
    );
  }
  if (list.isPending) return <LoadingSpinner />;

  const { items, count, limit } = list.data;
  const prefix = list.data.prefix ?? '!';
  const rows = filterCommands(items, search);
  const full = count >= (limit || COMMAND_LIMITS.commandsMax);

  return (
    <div className="tw-cmd-stack">
      <RecordTable<Command>
        caption="Custom commands"
        rows={rows}
        rowKey={(command) => command.id}
        activeKey={editing && editing !== 'new' ? editing.id : null}
        onRowClick={(command) => setEditing(command)}
        rowLabel={(command) => `Edit ${command.name}`}
        toolbar={(
          <div className="tw-cmd-toolbar">
            <Field label="Search commands" hideLabel>
              {(control) => (
                <div className="tw-cmd-search">
                  <Search size={16} aria-hidden="true" />
                  <input {...control} className="form-control" type="search" placeholder="Search names and responses"
                    value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} />
                </div>
              )}
            </Field>
            <span className="tw-muted" aria-live="polite">{count.toLocaleString()} of {limit.toLocaleString()} commands</span>
            <button type="button" className="btn primary" disabled={full} onClick={() => setEditing('new')}
              title={full ? 'This channel has reached the command limit.' : undefined}>
              <Plus size={16} aria-hidden="true" /> Add command
            </button>
          </div>
        )}
        columns={[
          {
            key: 'name', header: 'Command', primary: true,
            render: (command) => (
              <span className="tw-cmd-name">
                <span>{command.name}</span>
                {command.aliases.length > 0 && <small>{command.aliases.join(', ')}</small>}
              </span>
            ),
          },
          { key: 'response', header: 'Response', render: (command) => <span className="tw-cmd-response">{shorten(command.response)}</span> },
          { key: 'level', header: 'Who', width: '140px', render: (command) => levelLabel(command.level) },
          {
            key: 'cooldown', header: 'Cooldown', width: '110px', hideOnMobile: true,
            render: (command) => cooldownSummary(command.global_cooldown_s, command.user_cooldown_s),
          },
          {
            key: 'tags', header: 'Details', width: '150px', hideOnMobile: true,
            render: (command) => (
              <span className="tw-cmd-tags">
                {command.match_mode === 'keyword' && <StatusChip tone="neutral">Keyword</StatusChip>}
                {command.cost > 0 && <StatusChip tone="neutral">{command.cost.toLocaleString()} cost</StatusChip>}
                {command.hidden && <StatusChip tone="neutral">Hidden</StatusChip>}
                {command.availability !== 'always' && (
                  <StatusChip tone="neutral">{command.availability === 'online' ? 'Live only' : 'Offline only'}</StatusChip>
                )}
              </span>
            ),
          },
          { key: 'uses', header: 'Uses', width: '80px', align: 'end', render: (command) => command.use_count.toLocaleString() },
        ]}
        rowActions={(command) => (
          <Switch
            checked={command.enabled}
            label={`${command.name} enabled`}
            hideLabel
            disabled={toggle.isPending}
            onChange={(enabled) => toggle.mutate({ id: command.id, enabled })}
          />
        )}
        empty={search ? (
          <EmptyState title="No commands match" description="Try a shorter search, or clear it to see every command." />
        ) : (
          <EmptyState
            title="No custom commands yet"
            description={`Add one here, or type ${prefix}command add ${prefix}hello Hello $(user)! in chat as a moderator.`}
            action={<button type="button" className="btn primary" onClick={() => setEditing('new')}><Plus size={16} aria-hidden="true" /> Add command</button>}
          />
        )}
      />
      <CommandEditor channelId={channelId} editing={editing} prefix={prefix} onClose={() => setEditing(null)} />
    </div>
  );
};
