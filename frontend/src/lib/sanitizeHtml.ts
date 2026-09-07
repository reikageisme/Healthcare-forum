import DOMPurify, { type Config } from 'dompurify';

const SAFE_CONTENT_URL = /^(?:https?:\/\/[^\s]+|\/uploads(?:\/|$))/i;

const CONFIG: Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 's', 'ul', 'ol', 'li', 'blockquote',
    'pre', 'code', 'hr', 'h1', 'h2', 'h3', 'a', 'img',
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height', 'class'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['style'],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ALLOW_SELF_CLOSE_IN_ATTR: false,
};

function isSafeContentUrl(value: string): boolean {
  return SAFE_CONTENT_URL.test(value.trim());
}

/** Defense-in-depth for every HTML render sink; the backend remains mandatory. */
export function sanitizeHtml(value: string): string {
  const clean = DOMPurify.sanitize(value, { ...CONFIG, RETURN_TRUSTED_TYPE: false }) as string;
  const template = document.createElement('template');
  template.innerHTML = clean;

  template.content.querySelectorAll<HTMLElement>('a[href], img[src]').forEach((element) => {
    const attribute = element.tagName === 'A' ? 'href' : 'src';
    const url = element.getAttribute(attribute);
    if (!url || !isSafeContentUrl(url)) {
      if (element.tagName === 'IMG') {
        element.remove();
      } else {
        element.removeAttribute(attribute);
      }
    }
    if (element.tagName === 'A') {
      element.setAttribute('rel', 'noopener noreferrer nofollow');
      if (element.getAttribute('target') !== '_blank') element.removeAttribute('target');
    }
  });

  return template.innerHTML;
}
