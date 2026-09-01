import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Hono } from 'hono';
import sharp from 'sharp';
import { settings } from '../core/config.js';
import { HttpError, badRequest } from '../core/errors.js';
import { uploadResponseSchema } from '../schemas/responses.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadRateLimit } from '../middleware/rateLimit.js';

export const uploadRoutes = new Hono();

const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Detected format -> the extension and content type actually written. */
const FORMATS: Record<string, { ext: string; mime: string }> = {
  jpeg: { ext: '.jpg', mime: 'image/jpeg' },
  png: { ext: '.png', mime: 'image/png' },
  webp: { ext: '.webp', mime: 'image/webp' },
  gif: { ext: '.gif', mime: 'image/gif' },
};

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

uploadRoutes.post('/upload', requireAuth, uploadRateLimit, async (c) => {
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) {
    throw badRequest('No file uploaded. Expected a multipart field named "file".');
  }

  const name = file.name || '';
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw badRequest(
      `Unsupported file extension: ${ext}. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
    );
  }

  const contentType = (file.type || '').toLowerCase();
  if (!ALLOWED_MIME.has(contentType)) {
    throw badRequest(
      `Unsupported content type: ${contentType}. Allowed: ${[...ALLOWED_MIME].join(', ')}`,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_FILE_SIZE) {
    throw badRequest(`File size exceeds 5MB limit. Got ${bytes.byteLength} bytes.`);
  }
  if (bytes.byteLength === 0) {
    throw badRequest('Empty file upload is not allowed.');
  }

  // Decode the bytes rather than trusting the name or the declared type —
  // this is what stops a script or an HTML document arriving with a .png on
  // the end of it.
  let detected: string | undefined;
  try {
    detected = (await sharp(bytes, { animated: true }).metadata()).format;
  } catch {
    throw badRequest('Invalid image file or corrupted image data.');
  }

  const format = detected ? FORMATS[detected] : undefined;
  if (!format) {
    throw badRequest('Invalid image file or corrupted image data.');
  }

  // The stored name comes from what the bytes actually are, not from what
  // the client called the file.
  const uploadDir = join(process.cwd(), settings.UPLOAD_DIR);
  const filename = `${randomUUID().replace(/-/g, '')}${format.ext}`;
  try {
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), bytes);
  } catch (err) {
    // A write that fails here is a deployment problem, not a bad request:
    // in production /app/uploads is bind-mounted from the host, so the
    // directory arrives owned by the host user and the container's
    // unprivileged process cannot write into it (EACCES). Left unhandled it
    // reached the browser as a bare "Internal server error" with nothing in
    // it to act on, so name the cause in the log.
    const code = (err as NodeJS.ErrnoException).code ?? 'UNKNOWN';
    console.error(`[upload] cannot write to ${uploadDir} (${code})`, err);
    throw new HttpError(
      500,
      code === 'EACCES' || code === 'EPERM'
        ? 'Máy chủ không có quyền ghi thư mục ảnh. Vui lòng báo quản trị viên.'
        : code === 'ENOSPC'
          ? 'Máy chủ đã hết dung lượng lưu trữ ảnh. Vui lòng báo quản trị viên.'
          : 'Không thể lưu ảnh trên máy chủ. Vui lòng thử lại sau.',
    );
  }

  return c.json(
    uploadResponseSchema.parse({
      url: `/uploads/${filename}`,
      filename,
      content_type: format.mime,
      size: bytes.byteLength,
    }),
    201,
  );
});
