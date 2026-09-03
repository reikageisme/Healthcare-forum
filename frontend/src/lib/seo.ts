import { useEffect } from 'react';

/**
 * Sets the document title, description, canonical URL and Open Graph tags
 * for a route. A SPA leaves every page with the same <title> from index.html
 * otherwise, which is what makes a forum invisible in search results.
 *
 * ponytail: a useEffect over document.head, not react-helmet — it is ~30
 * lines against a dependency, and there is no SSR here for helmet to serve.
 * If the app ever moves to SSR, swap this for the framework's head API.
 */
export interface SeoOptions {
  title?: string;
  description?: string;
  image?: string | null;
  /** Path only, e.g. /posts/benh-tieu-duong */
  canonicalPath?: string;
  type?: 'website' | 'article';
  /** JSON-LD object; rendered into a script tag so Google can read it. */
  structuredData?: Record<string, unknown> | null;
}

const SITE_NAME = 'Medic Việt Nam';
const DEFAULT_TITLE = 'Medic Việt Nam — Diễn đàn Y tế và Sức khỏe';
const JSONLD_ID = 'seo-structured-data';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function useSeo(options: SeoOptions) {
  const {
    title,
    description,
    image,
    canonicalPath,
    type = 'website',
    structuredData = null,
  } = options;

  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    document.title = fullTitle;

    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    }
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMeta('meta[property="og:type"]', 'property', 'og:type', type);
    setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME);
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');

    if (image) {
      const absolute = image.startsWith('http') ? image : `${window.location.origin}${image}`;
      setMeta('meta[property="og:image"]', 'property', 'og:image', absolute);
    }

    if (canonicalPath) {
      const href = `${window.location.origin}${canonicalPath}`;
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', href);
      setMeta('meta[property="og:url"]', 'property', 'og:url', href);
    }

    // Structured data is per-page, so the previous page's block is removed
    // rather than left to describe the wrong article.
    document.getElementById(JSONLD_ID)?.remove();
    if (structuredData) {
      const script = document.createElement('script');
      script.id = JSONLD_ID;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    return () => {
      document.getElementById(JSONLD_ID)?.remove();
    };
  }, [title, description, image, canonicalPath, type, JSON.stringify(structuredData)]);
}

/** schema.org description of a forum post, for rich results. */
export function articleStructuredData(input: {
  title: string;
  description?: string | null;
  image?: string | null;
  authorName?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  url: string;
  isQuestion?: boolean;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': input.isQuestion ? 'MedicalWebPage' : 'Article',
    headline: input.title,
    description: input.description ?? undefined,
    image: input.image ? [input.image] : undefined,
    author: input.authorName ? { '@type': 'Person', name: input.authorName } : undefined,
    datePublished: input.publishedAt ?? undefined,
    dateModified: input.updatedAt ?? input.publishedAt ?? undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.url },
    publisher: { '@type': 'Organization', name: SITE_NAME },
    inLanguage: 'vi-VN',
  };
}
