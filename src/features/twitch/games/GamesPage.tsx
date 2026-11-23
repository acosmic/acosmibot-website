/**
 * Games (§11.4, §12.5): live controls, per-game settings, the trivia question bank and recent rounds.
 * Settings are one form held here, so switching tabs never loses an unsaved edit. The live controls
 * and the trivia bank act at once; only the settings tab has a save bar.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SectionProps, SettingsSectionResponse } from '../types';
import {
  ReadOnlyNotice,
  SectionPage,
  SettingsSaveBar,
  TabPanel,
  Tabs,
  channelPath,
  hasRole,
  tk,
  twitchApi,
  twitchRetry,
  useSectionSettings,
} from '../shared/ui';
import { LiveTab } from './LiveTab';
import { QuestionsTab } from './QuestionsTab';
import { RoundsTab } from './RoundsTab';
import { SettingsTab } from './SettingsTab';
import { settingsProblem, type GamesSettings } from './model';
import './games.css';

const PREFIX = 'tw-games';
const TABS = [
  { id: 'live', label: 'Live' },
  { id: 'settings', label: 'Settings' },
  { id: 'questions', label: 'Trivia questions' },
  { id: 'rounds', label: 'Recent rounds' },
];

export const GamesPage: React.FC<SectionProps> = ({ channelId, role }) => {
  const settings = useSectionSettings<GamesSettings>(channelId, 'games');
  const [tab, setTab] = useState('live');
  const loyalty = useQuery({
    queryKey: tk(channelId, 'settings', 'loyalty'),
    queryFn: () => twitchApi.get<SettingsSectionResponse<{ enabled: boolean; currency_name: string }>>(
      channelPath(channelId, '/settings/loyalty')),
    retry: twitchRetry,
  });
  const currency = loyalty.data?.value.currency_name || 'points';
  const loyaltyOff = loyalty.data?.value.enabled === false;
  const form = settings.form;
  const saved = settings.value;
  const problem = form ? settingsProblem(form) : null;

  return (
    <SectionPage
      title="Games"
      description={`Games viewers play in chat with their ${currency}. Start a raffle, a trivia question, bingo or a betting contest here, and choose the limits for every game.`}
      query={settings.query}
    >
      {loyaltyOff && (
        <p className="tw-games-note" role="status">
          Loyalty points are turned off, so every game is paused. Turn them on in Loyalty.
        </p>
      )}
      <Tabs tabs={TABS} active={tab} onChange={setTab} label="Games sections" idPrefix={PREFIX} />
      <TabPanel idPrefix={PREFIX} id="live" active={tab}>
        {form && saved && <LiveTab channelId={channelId} settings={saved} currency={currency} />}
      </TabPanel>
      <TabPanel idPrefix={PREFIX} id="settings" active={tab}>
        {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} what="the game settings" />}
        {form && (
          <SettingsTab form={form} disabled={!settings.canWrite} currency={currency}
            onChange={(next) => settings.setForm(next)} issuesFor={settings.issuesFor} />
        )}
        <SettingsSaveBar settings={settings} validationMessage={problem ?? undefined} />
      </TabPanel>
      <TabPanel idPrefix={PREFIX} id="questions" active={tab}>
        <QuestionsTab channelId={channelId} canImport={hasRole(role, 'editor')} />
      </TabPanel>
      <TabPanel idPrefix={PREFIX} id="rounds" active={tab}>
        <RoundsTab channelId={channelId} currency={currency} />
      </TabPanel>
    </SectionPage>
  );
};
