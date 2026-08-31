import type { Context } from 'hono';
import { ZodError } from 'zod';

/**
 * Mirrors FastAPI's HTTPException. The frontend reads
 * `err.response.data.detail` in ten places, so every error body this API
 * produces must carry a `detail` key.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly headers?: Record<string, string>;

  constructor(status: number, detail: string, headers?: Record<string, string>) {
    super(detail);
    this.name = 'HttpError';
    this.status = status;
    this.headers = headers;
  }
}

export const badRequest = (d: string) => new HttpError(400, d);
export const unauthorized = (d: string) =>
  new HttpError(401, d, { 'WWW-Authenticate': 'Bearer' });
export const forbidden = (d: string) => new HttpError(403, d);
export const notFound = (d: string) => new HttpError(404, d);
export const conflict = (d: string) => new HttpError(409, d);

/**
 * Pydantic's 422 body is `{detail: [{loc, msg, type}]}`.
 * CreatePostPage.tsx:120-124 branches on exactly that shape, so ZodError has
 * to be reshaped rather than passed through in Zod's own vocabulary.
 */
export function zodToDetail(err: ZodError) {
  return err.errors.map((issue) => ({
    loc: ['body', ...issue.path.map((p) => String(p))],
    msg: issue.message,
    type: issue.code,
  }));
}

export function registerErrorHandlers(app: {
  onError: (h: (err: Error, c: Context) => Response) => unknown;
  notFound: (h: (c: Context) => Response) => unknown;
}) {
  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ detail: err.message }, err.status as 400, err.headers);
    }
    if (err instanceof ZodError) {
      return c.json({ detail: zodToDetail(err) }, 422);
    }
    const httpish = err as { status?: number; getResponse?: () => Response };
    if (typeof httpish.status === 'number' && httpish.status < 500) {
      return c.json({ detail: err.message || 'Request failed' }, httpish.status as 400);
    }
    // Never leak a stack trace or driver message to the client.
    console.error('[unhandled]', err);
    return c.json({ detail: 'Internal server error' }, 500);
  });

  app.notFound((c) => c.json({ detail: 'Not Found' }, 404));
}
