/**
 * Public command list, `/t/:login/commands` (§11.1, §12.1). Reads
 * `GET /public/:login/commands` without a session. The API already leaves out
 * hidden and disabled commands and replaces custom API calls with
 * "[custom API]"; everything is rendered as plain text.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import { publicKey } from '../shared/queryKeys';
import { twitchRetry } from '../shared/api';
import { EmptyState, Field, levelLabel } from '../shared/ui';
import { publicCommandsApi } from './api';
import { filterCommands, type PublicCustomCommand, type PublicDefaultCommand } from './model';
import './commands.css';

const LevelTag: React.FC<{ name: string }> = ({ name }) => (
  <span className="tw-chip tw-chip--neutral"><span>{name === 'everyone' ? 'Everyone' : levelLabel(name)}</span></span>
);

const CustomItem: React.FC<{ command: PublicCustomCommand }> = ({ command }) => (
  <li className="tw-cmd-public__item">
    <div className="tw-cmd-public__head">
      <code className="tw-cmd-public__name">{command.name}</code>
      {command.aliases.length > 0 && <span className="tw-muted">also {command.aliases.join(', ')}</span>}
      <LevelTag name={command.level_name} />
    </div>
    {command.description && <p className="tw-cmd-public__description">{command.description}</p>}
    <p className="tw-cmd-public__response">{command.response}</p>
  </li>
);

const DefaultItem: React.FC<{ command: PublicDefaultCommand }> = ({ command }) => (
  <li className="tw-cmd-public__item">
    <div className="tw-cmd-public__head">
      <code className="tw-cmd-public__name">{command.usage || command.trigger}</code>
      {command.aliases.length > 0 && <span className="tw-muted">also {command.aliases.join(', ')}</span>}
      <LevelTag name={command.level_name} />
    </div>
    <p className="tw-cmd-public__description">{command.description}</p>
  </li>
);

export const PublicCommandsPage: React.FC<{ login: string }> = ({ login }) => {
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: publicKey(login, 'commands'),
    queryFn: () => publicCommandsApi.list(login),
    retry: twitchRetry,
    staleTime: 60_000,
  });

  if (query.isError) {
    return (
      <LoadFailed
        title="Commands didn't load"
        message={`${query.error instanceof Error ? query.error.message : 'Something went wrong.'} Try again in a moment.`}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (query.isPending) return <LoadingSpinner />;

  const custom = filterCommands(query.data.custom, search);
  const needle = search.trim().toLowerCase();
  const defaults = query.data.defaults.filter((item) => !needle
    || item.trigger.includes(needle) || item.aliases.some((alias) => alias.includes(needle))
    || item.description.toLowerCase().includes(needle));

  return (
    <section aria-labelledby="tw-public-commands-title" className="tw-cmd-stack">
      <h2 id="tw-public-commands-title" className="tw-section-title">Commands</h2>
      <Field label="Search commands" hideLabel>
        {(control) => (
          <div className="tw-cmd-search">
            <Search size={16} aria-hidden="true" />
            <input {...control} className="form-control" type="search" placeholder="Search commands" maxLength={100}
              value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        )}
      </Field>
      <div aria-live="polite" className="tw-cmd-stack">
        <section aria-labelledby="tw-public-commands-custom">
          <h3 id="tw-public-commands-custom" className="tw-cmd-public__title">Channel commands</h3>
          {custom.length === 0 ? (
            <EmptyState
              title={needle ? 'No channel commands match' : 'No channel commands yet'}
              description={needle ? 'Try another word.' : 'This channel has not published any commands of its own.'}
            />
          ) : (
            <ul className="tw-cmd-public">
              {custom.map((command) => <CustomItem key={command.name} command={command} />)}
            </ul>
          )}
        </section>
        <section aria-labelledby="tw-public-commands-defaults">
          <h3 id="tw-public-commands-defaults" className="tw-cmd-public__title">Built-in commands</h3>
          {defaults.length === 0 ? (
            <EmptyState title="No built-in commands match" description="Try another word." />
          ) : (
            <ul className="tw-cmd-public">
              {defaults.map((command) => <DefaultItem key={command.trigger} command={command} />)}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
};
