import React from 'react';
import { Clock3, FileCheck2, Scale, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/layout/PublicNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import '@/styles/legal.css';

/**
 * THESIS: Legal pages are governance records inside the constellation, not a stack of generic cards.
 * OWN-WORLD: An observatory field surrounds one opaque reading ledger, indexed by cyan route signals.
 * STORY: Readers identify the record, scan its scope and revision, navigate directly, then read calmly.
 * FIRST VIEWPORT: Record identity and orbital document proof lead; a policy switch and indexed ledger follow.
 * FORM: A field-manual reader extends the established Public Constellation documentation language.
 */

type LegalKind = 'terms' | 'privacy';

interface LegalLayoutProps {
  kind: LegalKind;
  title: string;
  subtitle: string;
  lastUpdated: string;
  children: React.ReactNode;
}

interface LegalSectionProps {
  title: string;
  children: React.ReactNode;
}

const sectionId = (title: string) => (
  `legal-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
);

export const LegalLayout: React.FC<LegalLayoutProps> = ({
  kind,
  title,
  subtitle,
  lastUpdated,
  children,
}) => {
  const sections = React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement<LegalSectionProps>(child) || typeof child.props.title !== 'string') {
      return [];
    }
    return [{ title: child.props.title, id: sectionId(child.props.title) }];
  });
  const RecordIcon = kind === 'terms' ? Scale : ShieldCheck;
  const recordLabel = kind === 'terms' ? 'Service agreement' : 'Data stewardship';

  return (
    <div className="legal-page" data-kind={kind}>
      <PublicNav variant="observatory" />

      <main className="legal-page__main">
        <header className="legal-hero">
          <div className="legal-hero__copy">
            <span className="legal-hero__kicker">
              <FileCheck2 aria-hidden="true" />
              Governance constellation
            </span>
            <h1>{title}</h1>
            <p>{subtitle}</p>

            <div className="legal-hero__metadata" aria-label="Document metadata">
              <span>
                <Clock3 aria-hidden="true" />
                Revised {lastUpdated}
              </span>
              <span>{sections.length} indexed sections</span>
            </div>
          </div>

          <div className="legal-orbit" aria-hidden="true">
            <span className="legal-orbit__ring legal-orbit__ring--outer" />
            <span className="legal-orbit__ring legal-orbit__ring--inner" />
            <span className="legal-orbit__satellite legal-orbit__satellite--one" />
            <span className="legal-orbit__satellite legal-orbit__satellite--two" />
            <div className="legal-orbit__record">
              <RecordIcon />
              <strong>{recordLabel}</strong>
              <span>{sections.length} sections · current</span>
            </div>
          </div>
        </header>

        <nav className="legal-record-switcher" aria-label="Legal documents">
          <span>Record set</span>
          <Link
            to="/terms-of-service"
            className={kind === 'terms' ? 'active' : undefined}
            aria-current={kind === 'terms' ? 'page' : undefined}
          >
            Terms of Service
          </Link>
          <Link
            to="/privacy-policy"
            className={kind === 'privacy' ? 'active' : undefined}
            aria-current={kind === 'privacy' ? 'page' : undefined}
          >
            Privacy Policy
          </Link>
        </nav>

        <div className="legal-workspace">
          <aside className="legal-index" aria-label={`${title} sections`}>
            <div className="legal-index__header">
              <span>Document index</span>
              <strong>{sections.length.toString().padStart(2, '0')} signals</strong>
            </div>
            <ol>
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>
                    <span>{(index + 1).toString().padStart(2, '0')}</span>
                    {section.title.replace(/^\d+\.\s*/, '')}
                    <i aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ol>
          </aside>

          <article className="legal-document">
            <details className="legal-mobile-index">
              <summary>
                <span>Jump to a section</span>
                <strong>{sections.length.toString().padStart(2, '0')}</strong>
              </summary>
              <ol>
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>
                      {(index + 1).toString().padStart(2, '0')} · {section.title.replace(/^\d+\.\s*/, '')}
                    </a>
                  </li>
                ))}
              </ol>
            </details>

            <div className="legal-content">{children}</div>

            <footer className="legal-document__footer">
              <div>
                <span>Publication record</span>
                <strong>{title}</strong>
              </div>
              <div>
                <span>Last updated</span>
                <strong>{lastUpdated}</strong>
              </div>
            </footer>
          </article>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export const LegalSection: React.FC<LegalSectionProps> = ({ title, children }) => (
  <section className="legal-section" id={sectionId(title)}>
    <h2>{title}</h2>
    {children}
  </section>
);

export const LegalSubheading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="legal-subheading">{children}</h3>
);

export const HighlightBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="legal-highlight">
    <span className="legal-highlight__signal" aria-hidden="true" />
    <div>{children}</div>
  </div>
);
