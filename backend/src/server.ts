import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.js';
import { settings } from './core/config.js';

const uploadDir = join(process.cwd(), settings.UPLOAD_DIR);
mkdirSync(uploadDir, { recursive: true });

const app = createApp();

// Same mount point the Python app used; vite proxies /uploads here.
app.use(
  '/uploads/*',
  serveStatic({
    root: `./${settings.UPLOAD_DIR}`,
    rewriteRequestPath: (path) => path.replace(/^\/uploads/, ''),
    onFound: (_path, c) => {
      // Uploaded files are user-supplied bytes. Never let a browser sniff
      // one into HTML, and never let it run as a document.
      c.header('X-Content-Type-Options', 'nosniff');
      c.header('Content-Security-Policy', "default-src 'none'; sandbox");
      c.header('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }),
);

serve({ fetch: app.fetch, port: settings.PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`${settings.PROJECT_NAME} backend listening on :${info.port}`);
});
