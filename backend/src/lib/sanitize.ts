import sanitizeHtml from 'sanitize-html';

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
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr',
    'a', 'img', 'span', 'div',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    span: ['class'],
    div: ['class'],
    code: ['class'],
    pre: ['class'],
    '*': ['style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // Blocks data: and blob: image sources, which can smuggle SVG script.
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowedStyles: {
    '*': {
      'text-align': [/^left$|^right$|^center$|^justify$/],
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i],
    },
  },
  transformTags: {
    // Stops reverse-tabnabbing on links a user pastes in.
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }, true),
  },
  disallowedTagsMode: 'discard',
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICH_TEXT);
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
