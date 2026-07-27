import React from 'react';
import { ArrowRight, BookOpen, Home, Radar, Server } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { PublicNav } from '@/components/layout/PublicNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import '@/styles/not-found.css';

/**
 * THESIS: A missing route is a lost signal in Acosmibot's map, not a generic centered error.
 * OWN-WORLD: A sparse observatory field uses one disconnected node, orbital route links, and cyan telemetry.
 * STORY: The visitor sees the failed coordinate, understands it is not registered, and chooses a known route.
 * FIRST VIEWPORT: Large recovery copy balances a live lost-signal topology with Home as the primary action.
 * FORM: An interactive route constellation extends the established graph world into a useful empty state.
 */

export const NotFoundPage: React.FC = () => {
  const { pathname } = useLocation();

  return (
    <div className="not-found-page">
      <PublicNav variant="observatory" />

      <main className="not-found-main">
        <section className="not-found-copy" aria-labelledby="not-found-title">
          <span className="not-found-kicker">
            <Radar aria-hidden="true" />
            Route telemetry · 404
          </span>

          <div className="not-found-coordinate" aria-label={`Unknown route: ${pathname}`}>
            <span>Unregistered coordinate</span>
            <code>{pathname}</code>
          </div>

          <h1 id="not-found-title">This signal drifted beyond the map.</h1>
          <p>
            The route does not exist, or its coordinates changed. Rejoin the constellation
            from a known signal below.
          </p>

          <div className="not-found-actions">
            <Link className="not-found-action not-found-action--primary" to="/">
              <Home aria-hidden="true" />
              Return home
            </Link>
            <Link className="not-found-action" to="/docs/introduction">
              Browse documentation
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>

          <div className="not-found-status">
            <span>
              <i aria-hidden="true" />
              Registry online
            </span>
            <span>No route match</span>
          </div>
        </section>

        <section className="not-found-map" aria-label="Known route constellation">
          <div className="not-found-map__stage">
            <span className="not-found-map__orbit not-found-map__orbit--outer" aria-hidden="true" />
            <span className="not-found-map__orbit not-found-map__orbit--inner" aria-hidden="true" />
            <span className="not-found-map__disconnect" aria-hidden="true" />

            <div className="not-found-map__lost" aria-hidden="true">
              <span>404</span>
              <strong>Signal lost</strong>
              <small>0 route matches</small>
            </div>

            <Link className="not-found-node not-found-node--home" to="/">
              <Home aria-hidden="true" />
              <span>Home</span>
              <small>Primary signal</small>
            </Link>
            <Link className="not-found-node not-found-node--docs" to="/docs/introduction">
              <BookOpen aria-hidden="true" />
              <span>Docs</span>
              <small>Field manual</small>
            </Link>
            <Link className="not-found-node not-found-node--servers" to="/servers">
              <Server aria-hidden="true" />
              <span>Servers</span>
              <small>Your communities</small>
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};
