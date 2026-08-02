import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  buildStructuredData,
  DOC_ROUTES,
  FEATURE_LANDINGS,
  getSeoMeta,
  HOME_TAGLINE,
  INDEXABLE_PUBLIC_PATHS,
  SITE_ORIGIN,
} from './src/seo/publicRoutes';

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const publicNav = `
  <nav aria-label="Primary navigation">
    <a href="/">Acosmibot</a>
    <a href="/features/ai-discord-bot">AI Discord Bot</a>
    <a href="/features/discord-leveling-bot">Leveling</a>
    <a href="/features/discord-economy-bot">Economy</a>
    <a href="/features/discord-games-bot">Games</a>
    <a href="/docs/introduction">Documentation</a>
    <a href="/pricing">Pricing</a>
  </nav>`;

const linkList = (links: Array<{ href: string; label: string }>) => `
  <ul class="seo-prerender__links">
    ${links.map(link => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join('\n')}
  </ul>`;

const renderHomeBody = () => `
  <div class="seo-prerender seo-prerender--home">
    ${publicNav}
    <main>
      <h1>${escapeHtml(HOME_TAGLINE)}</h1>
      <p>Acosmibot brings agentic AI, leveling, economy, games, rank cards, stream alerts, moderation, reaction roles, giveaways, and utilities into one connected Discord community system.</p>
      <h2>Explore Acosmibot's core Discord bot features</h2>
      ${linkList(Object.values(FEATURE_LANDINGS).map(feature => ({ href: `/features/${feature.slug}`, label: feature.title })))}
      ${Object.values(FEATURE_LANDINGS).map(feature => `
        <section>
          <h2><a href="/features/${feature.slug}">${escapeHtml(feature.title)}</a></h2>
          <p>${escapeHtml(feature.description)}</p>
          <ul>${feature.highlights.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </section>`).join('\n')}
      <h2>Set up every system</h2>
      ${linkList(DOC_ROUTES.map(([slug, label]) => ({ href: `/docs/${slug}`, label })))}
    </main>
  </div>`;

const renderFeatureBody = (slug: string) => {
  const feature = FEATURE_LANDINGS[slug];
  return `
    <div class="seo-prerender seo-prerender--feature">
      ${publicNav}
      <main>
        <p>${escapeHtml(feature.kicker)}</p>
        <h1>${escapeHtml(feature.title)}</h1>
        <p>${escapeHtml(feature.description)}</p>
        <p>${escapeHtml(feature.promise)}</p>
        <p><a href="${feature.documentationPath}">Read the ${escapeHtml(feature.kicker.toLowerCase())} documentation</a></p>
        <h2>What Acosmibot includes</h2>
        <ol>${feature.capabilities.map(capability => `<li><h3>${escapeHtml(capability.title)}</h3><p>${escapeHtml(capability.description)}</p></li>`).join('\n')}</ol>
        <h2>How it works in Discord</h2>
        <ol>${feature.steps.map(step => `<li><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.description)}</p></li>`).join('\n')}</ol>
        <h2>Related Acosmibot systems</h2>
        ${linkList(feature.related.map(link => ({ href: link.path, label: link.label })))}
      </main>
    </div>`;
};

const renderDocsBody = (slug: string) => {
  const viewPath = path.resolve(__dirname, `public/docs/views/${slug}-view.html`);
  const article = readFileSync(viewPath, 'utf8');
  const label = DOC_ROUTES.find(([itemSlug]) => itemSlug === slug)?.[1] ?? 'Acosmibot Documentation';
  return `
    <div class="seo-prerender seo-prerender--docs">
      ${publicNav}
      <main>
        <p>Documentation / ${escapeHtml(label)}</p>
        <aside aria-label="Documentation topics">
          ${linkList(DOC_ROUTES.map(([itemSlug, itemLabel]) => ({ href: `/docs/${itemSlug}`, label: itemLabel })))}
        </aside>
        <article>${article}</article>
      </main>
    </div>`;
};

const renderSimpleBody = (pathname: string) => {
  const meta = getSeoMeta(pathname);
  const copy = pathname === '/pricing'
    ? 'Compare the Free, Plus, Pro, and Max Acosmibot plans for Discord AI, leveling, economy, games, streaming alerts, and community tools.'
    : meta.description;
  return `
    <div class="seo-prerender seo-prerender--simple">
      ${publicNav}
      <main><h1>${escapeHtml(meta.title.split('|')[0].trim())}</h1><p>${escapeHtml(copy)}</p></main>
    </div>`;
};

const applyHead = (source: string, pathname: string, indexable = true) => {
  const meta = getSeoMeta(pathname);
  const canonical = `${SITE_ORIGIN}${meta.canonicalPath}`;
  const robots = indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow';
  const socialTitle = meta.socialTitle ?? meta.title;
  const replaceMeta = (html: string, selector: string, value: string) => html.replace(
    new RegExp(`(<meta\\s+${selector}\\s+content=")[^"]*("\\s*\\/?>)`, 'i'),
    `$1${escapeHtml(value)}$2`,
  );

  let html = source
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(/<link\s+rel="canonical"[^>]*>/i, indexable ? `<link rel="canonical" href="${canonical}" />` : '')
    .replace(/<script id="acosmibot-structured-data"[\s\S]*?<\/script>/i, '');
  html = replaceMeta(html, 'name="description"', meta.description);
  html = replaceMeta(html, 'name="robots"', robots);
  html = replaceMeta(html, 'property="og:title"', socialTitle);
  html = replaceMeta(html, 'property="og:description"', meta.description);
  html = replaceMeta(html, 'property="og:url"', indexable ? canonical : SITE_ORIGIN);
  html = replaceMeta(html, 'name="twitter:title"', socialTitle);
  html = replaceMeta(html, 'name="twitter:description"', meta.description);

  if (indexable) {
    const structuredData = JSON.stringify(buildStructuredData(meta)).replaceAll('<', '\\u003c');
    html = html.replace('</head>', `    <script id="acosmibot-structured-data" type="application/ld+json">${structuredData}</script>\n  </head>`);
  }
  return html;
};

const injectRoot = (source: string, body: string) => source.replace(
  '<div id="root"></div>',
  `<div id="root">${body}</div>`,
);

const seoStaticPages = (): Plugin => ({
  name: 'acosmibot-seo-static-pages',
  apply: 'build',
  closeBundle() {
    const outputDir = path.resolve(__dirname, 'dist');
    const shell = readFileSync(path.join(outputDir, 'index.html'), 'utf8');

    for (const pathname of INDEXABLE_PUBLIC_PATHS) {
      const featureSlug = pathname.match(/^\/features\/([^/]+)$/)?.[1];
      const docsSlug = pathname.match(/^\/docs\/([^/]+)$/)?.[1];
      const body = pathname === '/'
        ? renderHomeBody()
        : featureSlug
          ? renderFeatureBody(featureSlug)
          : docsSlug
            ? renderDocsBody(docsSlug)
            : renderSimpleBody(pathname);
      const html = injectRoot(applyHead(shell, pathname), body);
      const destination = pathname === '/'
        ? path.join(outputDir, 'index.html')
        : path.join(outputDir, pathname.slice(1), 'index.html');
      mkdirSync(path.dirname(destination), { recursive: true });
      writeFileSync(destination, html);
    }

    const appShell = applyHead(shell, '/dashboard', false)
      .replace('<div id="root"></div>', '<div id="root"></div>');
    writeFileSync(path.join(outputDir, 'app-shell.html'), appShell);

    const notFoundBody = `
      <div class="seo-prerender seo-prerender--not-found">
        ${publicNav}
        <main><h1>Page not found</h1><p>This Acosmibot route does not exist. Return to the <a href="/">Acosmibot homepage</a> or browse the <a href="/docs/introduction">documentation</a>.</p></main>
      </div>`;
    const notFound = injectRoot(applyHead(shell, '/not-found', false), notFoundBody)
      .replaceAll('Acosmibot Dashboard', 'Page Not Found | Acosmibot')
      .replaceAll(
        'Secure Acosmibot account and Discord server configuration.',
        'This Acosmibot route does not exist. Return to the homepage or browse the documentation.',
      );
    writeFileSync(path.join(outputDir, '404.html'), notFound);

    const sitemap = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...INDEXABLE_PUBLIC_PATHS.map(pathname => `  <url><loc>${SITE_ORIGIN}${pathname}</loc></url>`),
      '</urlset>',
      '',
    ].join('\n');
    writeFileSync(path.join(outputDir, 'sitemap.xml'), sitemap);

    // Azure Static Web Apps does not resolve extensionless SPA URLs to nested
    // index.html files consistently. Emit exact public rewrites from the same
    // manifest that creates the pages and sitemap, keeping all three in sync.
    const configPath = path.join(outputDir, 'staticwebapp.config.json');
    const staticWebAppConfig = JSON.parse(readFileSync(configPath, 'utf8')) as {
      routes: Array<Record<string, unknown>>;
    };
    const redirects = staticWebAppConfig.routes.filter(route => 'redirect' in route);
    const appRoutes = staticWebAppConfig.routes.filter(route => !('redirect' in route));
    const publicRewrites = INDEXABLE_PUBLIC_PATHS
      .filter(pathname => pathname !== '/')
      .map(pathname => ({ route: pathname, rewrite: `${pathname}/index.html` }));
    staticWebAppConfig.routes = [...redirects, ...publicRewrites, ...appRoutes];
    writeFileSync(configPath, `${JSON.stringify(staticWebAppConfig, null, 2)}\n`);
  },
});

export default defineConfig({
  plugins: [react(), seoStaticPages()],
  base: '/',
  server: {
    proxy: {
      '/api': {
        target: 'https://api.acosmibot.com',
        changeOrigin: true,
        secure: true,
      },
      '/auth': {
        target: 'https://api.acosmibot.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
