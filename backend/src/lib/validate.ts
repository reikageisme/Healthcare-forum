import type { Context } from 'hono';
import { z, ZodError } from 'zod';
import { badRequest } from '../core/errors.js';

/**
 * Reads and validates a JSON body. A ZodError bubbles up to the shared error
 * handler, which reshapes it into Pydantic's 422 body — the shape
 * CreatePostPage.tsx:120-124 expects.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw badRequest('Request body must be valid JSON');
  }
  return schema.parse(raw);
}

export function parseQuery<T extends z.ZodTypeAny>(c: Context, schema: T): z.infer<T> {
  return schema.parse(c.req.query());
}

/** Query params arrive as strings; these coerce the way FastAPI's Query did. */
export const intParam = (min: number, max: number, fallback: number) =>
  z.preprocess((v) => {
    if (v === undefined || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : v;
  }, z.number().int().min(min).max(max));

export const boolParam = (fallback: boolean) =>
  z.preprocess((v) => {
    if (v === undefined || v === '') return fallback;
    if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
    return v;
  }, z.boolean());

export { ZodError };
