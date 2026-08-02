/**
 * THESIS: Each feature is a working subsystem in Acosmibot's community constellation, not an isolated marketing card.
 * OWN-WORLD: Observatory void, opaque graphite ledgers, signal-cyan routes, and one feature-specific orbital color.
 * STORY: A server owner understands the outcome, sees the implemented mechanism, verifies concrete capabilities, and adds the bot.
 * FIRST VIEWPORT: Product promise and two actions lead on the left while a live request-to-result instrument proves the feature on the right.
 * FORM: Persuade-mode extension of the established homepage constellation; one focused subsystem route inside the existing world.
 */
import React from 'react';
import { ArrowRight, Bot, Check, Coins, Dices, Network, Orbit, Radio, Sparkles, TrendingUp, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/layout/PublicNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { trackEvent } from '@/lib/analytics';
import { DISCORD_INVITE_URL, FEATURE_LANDINGS, type FeatureLandingTheme } from '@/seo/publicRoutes';
import '@/styles/feature-landing.css';

const THEME_ICONS: Record<FeatureLandingTheme, LucideIcon> = {
  intelligence: Bot,
  leveling: TrendingUp,
  economy: Coins,
  games: Dices,
};

interface FeatureLandingPageProps {
  slug: keyof typeof FEATURE_LANDINGS;
}

export const FeatureLandingPage: React.FC<FeatureLandingPageProps> = ({ slug }) => {
  const feature = FEATURE_LANDINGS[slug];
  const FeatureIcon = THEME_ICONS[feature.theme];

  return (
    <div className={`feature-landing feature-landing--${feature.theme}`}>
      <div className="feature-landing__cosmos" aria-hidden="true" />
      <PublicNav variant="observatory" />

      <main>
        <section className="feature-hero">
          <div className="feature-shell feature-hero__layout">
            <div className="feature-hero__copy">
              <nav className="feature-breadcrumb" aria-label="Breadcrumb">
                <Link to="/">Acosmibot</Link>
                <span aria-hidden="true">/</span>
                <span>Features</span>
              </nav>
              <div className="feature-kicker">
                <span aria-hidden="true"><FeatureIcon /></span>
                {feature.kicker}
              </div>
              <h1>{feature.title}</h1>
              <p className="feature-hero__lede">{feature.description}</p>
              <p className="feature-hero__promise">{feature.promise}</p>
              <div className="feature-hero__actions">
                <a
                  className="feature-action feature-action--primary"
                  href={DISCORD_INVITE_URL}
                  onClick={() => trackEvent('bot_invite_start', { source: `feature_${feature.theme}` })}
                >
                  Add to Discord <ArrowRight aria-hidden="true" />
                </a>
                <Link className="feature-action feature-action--secondary" to={feature.documentationPath}>
                  Read the documentation
                </Link>
              </div>
              <p className="feature-availability"><Check aria-hidden="true" /> {feature.availability}</p>
            </div>

            <div className="feature-instrument" aria-label={`${feature.kicker} request flow`}>
              <div className="feature-instrument__header">
                <span><Radio aria-hidden="true" /> Live mechanism</span>
                <span>Discord → Acosmibot</span>
              </div>
              <div className="feature-instrument__core">
                <div className="feature-instrument__orbit" aria-hidden="true" />
                <div className="feature-instrument__node feature-instrument__node--request">
                  <span>Request</span>
                  <strong>Member intent</strong>
                </div>
                <div className="feature-instrument__hub">
                  <FeatureIcon aria-hidden="true" />
                  <strong>Acosmibot</strong>
                  <span>{feature.theme}</span>
                </div>
                <div className="feature-instrument__node feature-instrument__node--result">
                  <span>Result</span>
                  <strong>Discord response</strong>
                </div>
              </div>
              <div className="feature-instrument__signals">
                {feature.highlights.map(highlight => <span key={highlight}>{highlight}</span>)}
              </div>
            </div>
          </div>
        </section>

        <section className="feature-capabilities" aria-labelledby="capabilities-title">
          <div className="feature-shell feature-section-layout">
            <div className="feature-section-heading">
              <span>Inside the system</span>
              <h2 id="capabilities-title">What this changes for your Discord community.</h2>
              <p>Each capability below is implemented in Acosmibot today and connected to the same server configuration and member systems.</p>
            </div>
            <ol className="feature-ledger">
              {feature.capabilities.map((capability, index) => (
                <li key={capability.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{capability.title}</h3>
                    <p>{capability.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="feature-demonstration" aria-labelledby="demonstration-title">
          <div className="feature-shell">
            <div className="feature-demo-stage">
              <div className="feature-demo-stage__copy">
                <span>Implemented request path</span>
                <h2 id="demonstration-title">See the mechanism, not another feature claim.</h2>
                <p>{feature.demonstration.note}</p>
              </div>
              <div className="feature-demo-flow">
                <div className="feature-demo-flow__prompt">
                  <span>Discord request</span>
                  <strong>{feature.demonstration.prompt}</strong>
                </div>
                <ArrowRight aria-hidden="true" />
                <div className="feature-demo-flow__route">
                  <span>Acosmibot route</span>
                  <p>{feature.demonstration.route}</p>
                </div>
                <ArrowRight aria-hidden="true" />
                <div className="feature-demo-flow__result">
                  <span>Grounded result</span>
                  <p>{feature.demonstration.result}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="feature-process" aria-labelledby="process-title">
          <div className="feature-shell">
            <div className="feature-section-heading feature-section-heading--wide">
              <span>From setup to daily use</span>
              <h2 id="process-title">One clear path through the system.</h2>
            </div>
            <ol className="feature-process__track">
              {feature.steps.map((step, index) => (
                <li key={step.title}>
                  <div className="feature-process__marker">
                    <span>{index + 1}</span>
                    {index < feature.steps.length - 1 && <i aria-hidden="true" />}
                  </div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="feature-related" aria-labelledby="related-title">
          <div className="feature-shell">
            <div className="feature-related__heading">
              <Network aria-hidden="true" />
              <div>
                <span>Connected by design</span>
                <h2 id="related-title">Follow the system into related features.</h2>
              </div>
            </div>
            <div className="feature-related__links">
              {feature.related.map(related => (
                <Link key={related.path} to={related.path}>
                  <div>
                    <strong>{related.label}</strong>
                    <p>{related.description}</p>
                  </div>
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="feature-closing">
          <div className="feature-shell feature-closing__inner">
            <span className="feature-closing__mark" aria-hidden="true"><Orbit /></span>
            <div>
              <span>Bring the system online</span>
              <h2>Add Acosmibot, then shape it around your server.</h2>
            </div>
            <a
              className="feature-action feature-action--primary"
              href={DISCORD_INVITE_URL}
              onClick={() => trackEvent('bot_invite_start', { source: `feature_${feature.theme}_closing` })}
            >
              Add to Discord <Sparkles aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};
