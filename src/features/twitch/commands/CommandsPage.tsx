/**
 * Commands section (§11.4, §12.1): tabs Custom / Default commands / Regulars,
 * plus the `commands` settings section. The open tab is kept in `?tab=` so a
 * link or reload returns to it. Each tab owns its own loading, failed and
 * empty states.
 */
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SectionProps } from '../types';
import { SectionPage, TabPanel, Tabs } from '../shared/ui';
import { CustomCommandsTab } from './CustomCommandsTab';
import { DefaultCommandsTab } from './DefaultCommandsTab';
import { RegularsTab } from './RegularsTab';
import { CommandSettingsTab } from './CommandSettingsTab';
import './commands.css';

const TABS = [
  { id: 'custom', label: 'Custom' },
  { id: 'defaults', label: 'Default commands' },
  { id: 'regulars', label: 'Regulars' },
  { id: 'settings', label: 'Settings' },
] as const;
type TabId = typeof TABS[number]['id'];
const ID_PREFIX = 'tw-commands-tab';

const isTab = (value: string | null): value is TabId => TABS.some((tab) => tab.id === value);

export const CommandsPage: React.FC<SectionProps> = (props) => {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active: TabId = isTab(requested) ? requested : 'custom';

  const select = (id: string) => {
    const next = new URLSearchParams(params);
    if (id === 'custom') next.delete('tab');
    else next.set('tab', id);
    setParams(next, { replace: true });
  };

  return (
    <SectionPage
      title="Commands"
      description="What Acosmibot answers in chat: your own commands, the built-in ones, and who counts as a regular."
    >
      <Tabs tabs={[...TABS]} active={active} onChange={select} label="Command lists" idPrefix={ID_PREFIX} />
      <TabPanel idPrefix={ID_PREFIX} id="custom" active={active}>
        <CustomCommandsTab {...props} />
      </TabPanel>
      <TabPanel idPrefix={ID_PREFIX} id="defaults" active={active}>
        <DefaultCommandsTab {...props} />
      </TabPanel>
      <TabPanel idPrefix={ID_PREFIX} id="regulars" active={active}>
        <RegularsTab {...props} />
      </TabPanel>
      <TabPanel idPrefix={ID_PREFIX} id="settings" active={active}>
        <CommandSettingsTab {...props} />
      </TabPanel>
    </SectionPage>
  );
};
