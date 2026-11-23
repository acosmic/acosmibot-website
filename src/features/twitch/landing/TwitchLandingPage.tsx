/**
 * `/twitch` landing (§11.1, §11.4). Describes only what exists: the steps are
 * the sign-in and onboarding flows the API implements, and the feature list is
 * read from the section registry, so it grows only as slices ship.
 */
import React, { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, TriangleAlert, X } from 'lucide-react';
import { TWITCH_SECTIONS } from '../registry';
import { groupSections } from '../registryUtils';
import { startTwitchLogin } from '../shared/auth';
import { useTwitchAuthStore } from '../shared/authStore';
import { TwitchSignInButton } from '../shared/ui/basics';
import { TwitchPageFrame } from '../shared/ui/PageFrame';

const OAUTH_ERRORS: Record<string, string> = {
  invalid_oauth_state: 'That sign-in link expired or was already used. Start again.',
  oauth_denied: 'Twitch sign-in was cancelled, so nothing changed.',
  account_mismatch: 'Twitch approved a different account from the one signed in here. Sign in with the channel’s own account and try again.',
  missing_scopes: 'Acosmibot needs every permission on the Twitch screen to run in your channel. Try again and approve all of them.',
  capacity_reached: 'Acosmibot is not accepting new channels right now. Try again later.',
  wrong_bot_account: 'That Twitch account is not the configured Acosmibot bot account.',
  twitch_unavailable: 'Twitch did not respond. Try again in a moment.',
  missing_code: 'Twitch did not finish the sign-in. Start again.',
  session_required: 'Your Twitch session ended before Twitch sent you back. Sign in and try again.',
  forbidden: 'You no longer have permission to finish that step. Sign in with the right account and try again.',
  removal_pending: 'This channel is still being removed from Acosmibot. Try adding it again in a few minutes.',
  custom_bot_in_use: 'That Twitch account is already the custom bot for another channel. Choose a different account.',
  storage_failed: 'Acosmibot could not save the connection. Nothing was changed; try again in a moment.',
  server_error: 'Something went wrong on our side. Nothing was changed; try again in a moment.',
};

export const oauthErrorMessage = (code: string): string =>
  OAUTH_ERRORS[code] ?? 'Signing in with Twitch did not finish. Try again.';

const STEPS = [
  {
    title: 'Sign in with Twitch',
    body: 'Acosmibot reads your Twitch username, profile picture and the channels you moderate, then discards the sign-in token.',
  },
  {
    title: 'Add Acosmibot to your channel',
    body: 'As the broadcaster, approve the permissions it needs to chat and moderate. You can let it make its bot account a moderator so it keeps up with busy chat.',
  },
  {
    title: 'Manage it here',
    body: 'Broadcasters, editors and moderators each see the parts of the dashboard their role allows.',
  },
];

export const TwitchLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const me = useTwitchAuthStore((state) => state.me);
  const errorCode = params.get('error');
  const features = useMemo(() => groupSections(TWITCH_SECTIONS, 'broadcaster'), []);
  const ownChannelOnboarded = me?.own_channel.onboarded ?? false;

  const dismissError = () => {
    const next = new URLSearchParams(params);
    next.delete('error');
    setParams(next, { replace: true });
  };

  const addChannel = () => {
    if (me) navigate('/twitch/dashboard');
    else startTwitchLogin('/twitch/dashboard');
  };

  return (
    <TwitchPageFrame className="tw-landing" labelledBy="tw-landing-title">
      {errorCode && (
        <div className="tw-banner tw-banner--error" role="alert">
          <TriangleAlert aria-hidden="true" />
          <p>{oauthErrorMessage(errorCode)}</p>
          <button type="button" className="tw-icon-button" onClick={dismissError} aria-label="Dismiss message">
            <X aria-hidden="true" />
          </button>
        </div>
      )}

      <section className="tw-landing__hero">
        <p className="tw-kicker">Acosmibot on Twitch</p>
        <h1 id="tw-landing-title">A chat bot and dashboard for your Twitch channel</h1>
        <p className="tw-landing__lead">
          Add Acosmibot to your Twitch chat and run it from this website. Sign in with your Twitch account to open
          the channels you broadcast, edit or moderate.
        </p>
        <div className="tw-landing__actions">
          {me ? (
            <Link className="btn primary tw-button-lg" to="/twitch/dashboard">
              Open your channels
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          ) : (
            <TwitchSignInButton className="tw-button-lg" onClick={() => startTwitchLogin('/twitch/dashboard')} />
          )}
          {!ownChannelOnboarded && (
            <button type="button" className="btn tw-button-lg" onClick={addChannel}>
              Add Acosmibot to your channel
            </button>
          )}
        </div>
        {me && (
          <p className="tw-landing__identity">
            Signed in to Twitch as <strong>{me.user.display_name || me.user.login}</strong>.
          </p>
        )}
      </section>

      <section className="tw-landing__section" aria-labelledby="tw-landing-steps">
        <h2 id="tw-landing-steps">How it works</h2>
        <ol className="tw-steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="tw-steps__index" aria-hidden="true">{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="tw-landing__section" aria-labelledby="tw-landing-features">
        <h2 id="tw-landing-features">In the dashboard</h2>
        <p className="tw-landing__note">This list shows the parts of the Twitch dashboard that are available now.</p>
        <div className="tw-feature-ledger">
          {features.map((group) => (
            <div key={group.id} className="tw-feature-ledger__group">
              <h3>{group.label ?? 'Channel'}</h3>
              <ul>
                {group.sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <li key={section.id}>
                      <Icon aria-hidden="true" />
                      <div>
                        <strong>{section.label}</strong>
                        {section.summary && <span>{section.summary}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="tw-landing__footer">
        <p>
          You can remove Acosmibot from your channel at any time in your Twitch connection settings.
          Looking for Acosmibot on Discord? <Link to="/">Visit the homepage</Link>.
        </p>
      </footer>
    </TwitchPageFrame>
  );
};
