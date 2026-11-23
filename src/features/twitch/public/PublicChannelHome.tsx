/**
 * `/t/:login` public home (§11.1): live state and links to the public pages
 * the streamer has turned on and this website has built.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink } from 'lucide-react';
import type { PublicChannelResponse, TwitchPublicPage } from '../types';
import { EmptyState } from '../shared/ui/basics';
import { formatNumber, formatRelative } from '../shared/ui/format';

interface PublicChannelHomeProps {
  login: string;
  channel: PublicChannelResponse['channel'];
  pages: TwitchPublicPage[];
}

export const PublicChannelHome: React.FC<PublicChannelHomeProps> = ({ login, channel, pages }) => {
  const live = channel.live?.live ? channel.live : null;

  return (
    <div className="tw-public-home">
      <section className="tw-public-home__live" aria-labelledby="tw-public-live-title">
        <h2 id="tw-public-live-title">{live ? 'Live now' : 'Offline'}</h2>
        {live ? (
          <dl className="tw-overview-live__facts">
            {live.title && <div><dt>Title</dt><dd>{live.title}</dd></div>}
            {live.category_name && <div><dt>Category</dt><dd>{live.category_name}</dd></div>}
            {typeof live.viewer_count === 'number' && <div><dt>Viewers</dt><dd>{formatNumber(live.viewer_count)}</dd></div>}
            {live.started_at && <div><dt>Started</dt><dd>{formatRelative(live.started_at)}</dd></div>}
          </dl>
        ) : (
          <p className="tw-muted">{channel.display_name} is not streaming right now.</p>
        )}
        <a className="btn" href={`https://www.twitch.tv/${encodeURIComponent(login)}`} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden="true" size={16} />
          {live ? 'Watch on Twitch' : 'Open on Twitch'}
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      </section>

      <section aria-labelledby="tw-public-pages-title">
        <h2 id="tw-public-pages-title" className="tw-section-title">Channel pages</h2>
        {pages.length ? (
          <ul className="tw-link-ledger">
            {pages.map((page) => (
              <li key={page.id}>
                <Link to={`/t/${login}/${page.id}`}>
                  <span>
                    <strong>{page.label}</strong>
                    {page.summary && <small>{page.summary}</small>}
                  </span>
                  <ChevronRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No public pages" description={`${channel.display_name} has not turned on any public pages.`} />
        )}
      </section>
    </div>
  );
};
