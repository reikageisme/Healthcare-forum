import type { MiddlewareHandler } from 'hono';
import { HttpError } from '../core/errors.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Small in-process limiter. The Python app had none, which left /auth/login
 * open to unlimited credential stuffing and /reports open to flooding the
 * moderation queue — the cheapest way to break a forum that relies on
 * human review.
 *
 * In-process state is enough for a single-container deployment. Behind more
 * than one replica this becomes per-replica; that is a deliberate trade for
 * not adding Redis at this size.
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message?: string;
}): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();

  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'local';
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();

    // Opportunistic sweep so the map cannot grow without bound.
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      await next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      const retry = Math.ceil((bucket.resetAt - now) / 1000);
      throw new HttpError(
        429,
        options.message ?? 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
        { 'Retry-After': String(retry) },
      );
    }
    await next();
  };
}

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  keyPrefix: 'login',
  message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.',
});

export const registerRateLimit = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  keyPrefix: 'register',
  message: 'Quá nhiều tài khoản được tạo từ địa chỉ này. Vui lòng thử lại sau.',
});

export const reportRateLimit = rateLimit({
  windowMs: 60 * 60_000,
  max: 20,
  keyPrefix: 'report',
  message: 'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau.',
});

export const uploadRateLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyPrefix: 'upload',
  message: 'Bạn đang tải lên quá nhanh. Vui lòng thử lại sau.',
});
