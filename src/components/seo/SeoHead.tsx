import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { buildStructuredData, getSeoMeta, SITE_ORIGIN } from '@/seo/publicRoutes';

const upsertMeta = (selector: string, attributes: Record<string, string>) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element?.setAttribute(name, value));
};

const setCanonical = (href: string | null) => {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = href;
};

export const SeoHead = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = getSeoMeta(pathname);
    const canonical = meta.indexable ? `${SITE_ORIGIN}${meta.canonicalPath}` : null;
    const robots = meta.indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow';
    const socialTitle = meta.socialTitle ?? meta.title;

    document.title = meta.title;
    upsertMeta('meta[name="description"]', { name: 'description', content: meta.description });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Acosmibot' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: socialTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: meta.description });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical ?? SITE_ORIGIN });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: socialTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: meta.description });
    setCanonical(canonical);

    let script = document.head.querySelector<HTMLScriptElement>('#acosmibot-structured-data');
    if (!meta.indexable) {
      script?.remove();
      return;
    }
    if (!script) {
      script = document.createElement('script');
      script.id = 'acosmibot-structured-data';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(buildStructuredData(meta));
  }, [pathname]);

  return null;
};
