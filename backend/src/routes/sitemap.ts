import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, posts, tags } from '../db/schema.js';
import { settings } from '../core/config.js';

export const sitemapRoutes = new Hono();

/** Google will not index what it cannot enumerate; a SPA gives it nothing. */
const MAX_URLS = 5000;

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (ch) =>
    ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch === "'" ? '&apos;' : '&quot;',
  );

function urlEntry(loc: string, lastmod?: Date, changefreq = 'weekly', priority = '0.6') {
  const parts = [`    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>`);
  parts.push(`    <changefreq>${changefreq}</changefreq>`, `    <priority>${priority}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

sitemapRoutes.get('/sitemap.xml', async (c) => {
  const base = settings.SITE_URL.replace(/\/$/, '');

  const [postRows, categoryRows, tagRows] = await Promise.all([
    db
      .select({ slug: posts.slug, updated_at: posts.updated_at })
      .from(posts)
      .where(and(eq(posts.status, 'approved'), eq(posts.is_published, true)))
      .orderBy(desc(posts.updated_at))
      .limit(MAX_URLS),
    db.select({ slug: categories.slug }).from(categories),
    db.select({ slug: tags.slug }).from(tags).limit(500),
  ]);

  const urls = [
    urlEntry(`${base}/`, undefined, 'hourly', '1.0'),
    ...categoryRows.map((r) => urlEntry(`${base}/category/${r.slug}`, undefined, 'daily', '0.8')),
    ...postRows.map((r) => urlEntry(`${base}/posts/${r.slug}`, r.updated_at, 'weekly', '0.7')),
    ...tagRows.map((r) => urlEntry(`${base}/tags/${r.slug}`, undefined, 'weekly', '0.4')),
  ];

  c.header('Content-Type', 'application/xml; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=3600');
  return c.body(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
  );
});

sitemapRoutes.get('/robots.txt', (c) => {
  const base = settings.SITE_URL.replace(/\/$/, '');
  c.header('Content-Type', 'text/plain; charset=utf-8');
  return c.body(
    ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /login', '', `Sitemap: ${base}/sitemap.xml`, ''].join('\n'),
  );
});
