import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Palette } from 'lucide-react';
import type { ServerImageKind } from '@/api/serverImages';
import { IMAGE_KINDS, ServerImagesPanel } from '@/features/server-images/ServerImagesPanel';
import { useServerImages } from '@/features/server-images/useServerImages';
import { EmojiPacksPanel } from './EmojiPacksPanel';
import { useEmojiPacks } from './useEmojiPacks';
import '@/features/server-images/ServerImagesPage.css';

type Tab = ServerImageKind | 'emoji';
const TABS: Tab[] = ['icon', 'banner', 'splash', 'emoji'];

/** Server icon, banner, invite background and emoji packs in one place (Plus and higher). */
export const ServerBrandingPage: React.FC = () => {
  const { guildId = '' } = useParams<{ guildId: string }>();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) ? requested : 'icon';
  const images = useServerImages(guildId).query.data?.images ?? [];
  const packCount = useEmojiPacks(guildId).query.data?.packs.length ?? 0;

  const select = (next: Tab) => setParams(next === 'icon' ? {} : { tab: next }, { replace: true });

  return (
    <div className="feature-page server-images-page">
      <header className="page-header text-start mt-0 mb-4">
        <span className="server-images-kicker"><Palette aria-hidden="true" /> Server identity</span>
        <h1>Server Branding</h1>
        <p>
          Your server's icon, banner, invite background and emojis, all in one place. Everything Acosmibot replaces is
          saved first, so you can always switch back.
        </p>
      </header>

      <div className="server-images-tabs" role="tablist" aria-label="Branding type">
        {IMAGE_KINDS.map((item) => (
          <TabButton key={item.kind} active={tab === item.kind} label={item.label}
            count={images.filter((image) => image.kind === item.kind).length} onClick={() => select(item.kind)} />
        ))}
        <span className="server-images-tabs__divider" aria-hidden="true" />
        <TabButton active={tab === 'emoji'} label="Emoji Packs" count={packCount} onClick={() => select('emoji')} />
      </div>

      {tab === 'emoji' ? <EmojiPacksPanel /> : <ServerImagesPanel key={tab} kind={tab} />}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; label: string; count: number; onClick: () => void }> = ({
  active, label, count, onClick,
}) => (
  <button type="button" role="tab" aria-selected={active} className={`server-images-tab${active ? ' is-active' : ''}`} onClick={onClick}>
    {label}
    <span className="server-images-tab__count">{count}</span>
  </button>
);
