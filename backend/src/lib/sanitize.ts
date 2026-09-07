import sanitizeHtml from 'sanitize-html';
import { unprocessable } from '../core/errors.js';

/**
 * Post and comment bodies are written with TipTap and rendered by the
 * frontend through dangerouslySetInnerHTML (PostDetailPage, and the preview
 * inside the moderation queue). Unsanitised, a normal user could plant a
 * script that runs inside a moderator's session the moment their post is
 * reviewed, and the auth store keeps its token in localStorage.
 *
 * Cleaning happens here, on write, so there is exactly one place to get it
 * right and stored content is safe no matter who renders it later.
 */
const RICH_TEXT: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 's', 'ul', 'ol', 'li', 'blockquote',
    'pre', 'code', 'hr', 'h1', 'h2', 'h3', 'a', 'img',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    code: ['class'],
    pre: ['class'],
  },
  allowedSchemes: ['http', 'https'],
  allowProtocolRelative: false,
  transformTags: {
    a: cleanUrlAttributes,
    img: cleanUrlAttributes,
  },
  disallowedTagsMode: 'discard',
};

const SAFE_CONTENT_URL = /^(?:https?:\/\/[^\s]+|\/uploads(?:\/|$))/i;

/** http(s) and the application's own upload path are the only content URLs. */
export function isSafeContentUrl(value: string | null | undefined): boolean {
  return typeof value === 'string' && SAFE_CONTENT_URL.test(value.trim());
}

function cleanUrlAttributes(
  tagName: string,
  attribs: Record<string, string>,
): { tagName: string; attribs: Record<string, string> } {
  const attribute = tagName === 'a' ? 'href' : tagName === 'img' ? 'src' : null;
  if (attribute && attribs[attribute] && !isSafeContentUrl(attribs[attribute])) {
    delete attribs[attribute];
  }
  if (tagName === 'a') {
    // Stops reverse-tabnabbing on links a user pastes in.
    attribs.rel = 'noopener noreferrer nofollow';
    if (attribs.target && attribs.target !== '_blank') delete attribs.target;
  }
  return { tagName, attribs };
}

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICH_TEXT);
}

export function sanitizeImageUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return isSafeContentUrl(value) ? value.trim() : null;
}

export function requireSafeImageUrl(value: string): string {
  const clean = sanitizeImageUrl(value);
  if (!clean) throw unprocessable('Thumbnail URL is not safe');
  return clean;
}

export function assertVisibleRichText(
  html: string,
  minimum = 5,
  detail = 'Post content must contain at least 5 visible characters',
): void {
  const visible = stripHtmlAndTruncate(html)
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .trim();
  if (visible.length < minimum) throw unprocessable(detail);
}

/** For fields rendered as plain text (excerpt, report reason, bio). */
export function sanitizePlainText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}

/** Mirrors strip_html_and_truncate() in posts.py. */
export function stripHtmlAndTruncate(html: string, maxLength = 200): string {
  const clean = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).join(' ');
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}
