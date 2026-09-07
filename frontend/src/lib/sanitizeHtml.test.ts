// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('XSS-09 strips executable markup, unsafe URLs and styles while preserving TipTap markup', () => {
    const clean = sanitizeHtml(
      '<h1>Heading</h1><p><strong>Visible text</strong></p>' +
        '<a href="javascript:alert(1)" onclick="alert(1)">bad</a>' +
        '<a href="https://example.com/ok" target="_blank">good link</a>' +
        '<img src="data:image/svg+xml,<svg onload=alert(1)>" onerror="alert(1)">' +
        '<img src="/uploads/health.png" alt="good image">' +
        '<p style="background:url(javascript:alert(1))">styled text</p>',
    );

    expect(clean).not.toMatch(/<script\b/i);
    expect(clean).not.toMatch(/\son\w+\s*=/i);
    expect(clean).not.toMatch(/javascript\s*:/i);
    expect(clean).not.toMatch(/data\s*:/i);
    expect(clean).not.toMatch(/style\s*=/i);
    expect(clean).toContain('<h1>Heading</h1>');
    expect(clean).toContain('<strong>Visible text</strong>');
    expect(clean).toContain('href="https://example.com/ok"');
    expect(clean).toContain('src="/uploads/health.png"');
  });

  it('removes protocol-relative, backslash and non-upload relative image URLs', () => {
    const clean = sanitizeHtml(
      '<img src="//evil.example/a.png"><img src="/avatars/user.png">' +
        '<a href="/internal">internal</a><a href="/uploads/ok.png">upload</a>',
    );

    expect(clean).not.toContain('//evil.example');
    expect(clean).not.toContain('/avatars/user.png');
    expect(clean).not.toContain('href="/internal"');
    expect(clean).toContain('href="/uploads/ok.png"');
  });
});
