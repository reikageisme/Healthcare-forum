import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { settings } from './core/config.js';
import { registerErrorHandlers } from './core/errors.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { postRoutes } from './routes/posts.js';
import { categoryRoutes } from './routes/categories.js';
import { tagRoutes } from './routes/tags.js';
import { commentRoutes } from './routes/comments.js';
import { reactionRoutes } from './routes/reactions.js';
import { bookmarkRoutes } from './routes/bookmarks.js';
import { reportRoutes } from './routes/reports.js';
import { adminRoutes } from './routes/admin.js';
import { uploadRoutes } from './routes/upload.js';
import { verificationRoutes } from './routes/verification.js';
import { sitemapRoutes } from './routes/sitemap.js';
import { storyRoutes } from './routes/stories.js';

/**
 * Chỉ ghi log những request chậm bất thường. Khi người dùng báo "trang này
 * lâu quá" thì đây là thứ trả lời được câu hỏi đó bằng con số, thay vì phải
 * đoán xem chỗ nào chậm.
 */
const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS ?? 1000);

export function createApp() {
  const app = new Hono();

  app.use('*', async (c, next) => {
    const started = Date.now();
    await next();
    const ms = Date.now() - started;
    if (ms >= SLOW_REQUEST_MS) {
      console.warn(`[slow] ${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
    }
  });

  app.use('*', secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
    // The API serves JSON and static images only; nothing here should ever
    // be executed as a document.
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  }));

  // The Python app sent allow_origins=["*"] with allow_credentials=True.
  // Browsers reject that pairing, and it would be unsafe if they did not.
  app.use('/api/*', cors({
    origin: settings.CORS_ORIGINS,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }));

  const v1 = new Hono();

  v1.get('/health', (c) => c.json({ status: 'ok', version: settings.VERSION }));

  v1.route('/auth', authRoutes);
  v1.route('/users', userRoutes);
  v1.route('/posts', postRoutes);
  v1.route('/categories', categoryRoutes);
  v1.route('/tags', tagRoutes);
  v1.route('/reports', reportRoutes);
  v1.route('/admin', adminRoutes);
  v1.route('/verifications', verificationRoutes);
  v1.route('/stories', storyRoutes);

  // These routers carried no prefix in FastAPI; their paths are absolute
  // (/posts/{id}/comments, /users/me/bookmarks) and mount at the v1 root.
  v1.route('/', commentRoutes);
  v1.route('/', reactionRoutes);
  v1.route('/', bookmarkRoutes);
  v1.route('/', uploadRoutes);

  app.route('/api/v1', v1);

  // Served from the site root, not under /api — crawlers look for them there.
  app.route('/', sitemapRoutes);

  registerErrorHandlers(app);
  return app;
}

export type App = ReturnType<typeof createApp>;
