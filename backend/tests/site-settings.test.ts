import { describe, expect, it } from 'vitest';
import { normalizeNetwork } from '../src/lib/siteSettings.js';

describe('normalizeNetwork', () => {
  it('keeps safe web links and rejects executable or protocol-relative URLs', () => {
    const config = normalizeNetwork({
      sites: [
        { name: 'MedicVN', url: 'https://medicvn.com', icon_url: '/uploads/logo.webp' },
        { name: 'Bad', url: 'javascript:alert(1)' },
        { name: 'Internal', url: '/admin' },
      ],
      footer_links: [
        { name: 'Điều khoản', url: '/dieu-khoan' },
        { name: 'Evil', url: '//evil.example' },
      ],
      facebook_url: 'https://facebook.com/medicvn',
    });

    expect(config.sites).toEqual([
      {
        name: 'MedicVN',
        url: 'https://medicvn.com',
        description: undefined,
        icon_url: '/uploads/logo.webp',
      },
    ]);
    expect(config.footer_links).toEqual([
      { name: 'Điều khoản', url: '/dieu-khoan', description: undefined, icon_url: undefined },
    ]);
    expect(config.facebook_url).toBe('https://facebook.com/medicvn');
  });

  it('drops unsafe Facebook schemes', () => {
    expect(normalizeNetwork({ facebook_url: 'data:text/html,hello' }).facebook_url).toBe('');
  });
});
