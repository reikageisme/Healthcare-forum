import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { siteSettings } from '../db/schema.js';
import { settings } from '../core/config.js';

/**
 * Cấu hình mạng lưới & chân trang.
 *
 * Nguồn là bảng site_settings, sửa được trong /admin. Biến môi trường
 * NETWORK_* / FOOTER_LINKS / CONTACT_EMAIL vẫn được giữ làm giá trị mặc định
 * cho lần chạy đầu: cài mới hoặc bản đã cấu hình sẵn qua .env vẫn hiển thị
 * đúng ngay từ lượt khởi động đầu tiên, và khi quản trị viên lưu lần đầu thì
 * bản ghi trong bảng thắng từ đó về sau.
 */

export interface SiteLink {
  name: string;
  url: string;
  description?: string;
}

export interface NetworkConfig {
  name: string;
  tagline: string;
  sites: SiteLink[];
  footer_links: SiteLink[];
  contact_email: string;
}

export const NETWORK_KEY = 'network';

function cleanLinks(raw: unknown, limit: number): SiteLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is Record<string, unknown> =>
        !!x && typeof x === 'object' && typeof x.name === 'string' && typeof x.url === 'string',
    )
    .map((x) => ({
      name: String(x.name).trim().slice(0, 120),
      url: String(x.url).trim().slice(0, 500),
      description: x.description ? String(x.description).trim().slice(0, 300) : undefined,
    }))
    .filter((link) => link.name && link.url)
    .slice(0, limit);
}

/** Giá trị từ .env, dùng khi bảng chưa có bản ghi nào. */
function fromEnv(): NetworkConfig {
  return {
    name: settings.NETWORK_NAME,
    tagline: settings.NETWORK_TAGLINE,
    sites: settings.NETWORK_SITES,
    footer_links: settings.FOOTER_LINKS,
    contact_email: settings.CONTACT_EMAIL,
  };
}

export function normalizeNetwork(raw: unknown): NetworkConfig {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    name: typeof obj.name === 'string' ? obj.name.trim().slice(0, 120) : '',
    tagline: typeof obj.tagline === 'string' ? obj.tagline.trim().slice(0, 300) : '',
    sites: cleanLinks(obj.sites, 20),
    footer_links: cleanLinks(obj.footer_links, 12),
    contact_email:
      typeof obj.contact_email === 'string' ? obj.contact_email.trim().slice(0, 255) : '',
  };
}

export async function readNetworkConfig(): Promise<NetworkConfig> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, NETWORK_KEY))
    .limit(1);

  if (!rows[0]) return fromEnv();
  return normalizeNetwork(rows[0].value);
}

export async function writeNetworkConfig(raw: unknown): Promise<NetworkConfig> {
  const value = normalizeNetwork(raw);
  await db
    .insert(siteSettings)
    .values({ key: NETWORK_KEY, value })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value, updated_at: new Date() },
    });
  return value;
}
