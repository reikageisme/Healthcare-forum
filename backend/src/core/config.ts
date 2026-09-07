import 'dotenv/config';

function toPgUrl(raw: string): string {
  // The Python stack used SQLAlchemy's driver-qualified URL
  // (postgresql+asyncpg://). node-postgres wants a plain postgres:// URL.
  return raw.replace(/^postgresql\+asyncpg:\/\//, 'postgresql://');
}

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@db:5432/healthcare_forum';
const DEFAULT_JWT_SECRET = 'supersecret_jwt_key_here';

export function parseOrigins(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return ['http://localhost:3000'];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* fall through to comma parsing */
    }
  }
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

export interface ProductionConfigInput {
  environment: string;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigins: string[];
  databaseConfigured: boolean;
  jwtConfigured: boolean;
  corsConfigured: boolean;
}

function isSafeDatabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return false;
    if (!url.hostname || !url.pathname || url.pathname === '/') return false;
    return value !== DEFAULT_DATABASE_URL;
  } catch {
    return false;
  }
}

function isSafeOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.origin === value.replace(/\/+$/, '')
    );
  } catch {
    return false;
  }
}

export function validateProductionConfig(input: ProductionConfigInput): void {
  if (input.environment !== 'production') return;
  if (!input.databaseConfigured || !isSafeDatabaseUrl(input.databaseUrl)) {
    throw new Error(
      'DATABASE_URL must be explicitly configured with a non-development PostgreSQL URL in production.',
    );
  }
  if (
    !input.jwtConfigured ||
    input.jwtSecret === DEFAULT_JWT_SECRET ||
    input.jwtSecret.length < 32
  ) {
    throw new Error(
      'JWT_SECRET must be explicitly configured with at least 32 characters in production.',
    );
  }
  if (
    !input.corsConfigured ||
    input.corsOrigins.length === 0 ||
    input.corsOrigins.includes('*') ||
    input.corsOrigins.some((origin) => !isSafeOrigin(origin))
  ) {
    throw new Error(
      'BACKEND_CORS_ORIGINS must list explicit http(s) origins in production; "*" is not allowed.',
    );
  }
}

const rawOrigins = parseOrigins(process.env.BACKEND_CORS_ORIGINS);
const databaseConfigured = !!process.env.DATABASE_URL?.trim();
const jwtConfigured = !!process.env.JWT_SECRET?.trim();
const corsConfigured = !!process.env.BACKEND_CORS_ORIGINS?.trim();

export interface NetworkSite {
  name: string;
  url: string;
  description?: string;
}

/**
 * Các trang cùng mạng lưới, đọc từ biến môi trường NETWORK_SITES.
 *
 * Danh sách này thay đổi vài lần một năm nên nó là cấu hình, không phải dữ
 * liệu: một bảng trong database kèm trang quản trị CRUD cho năm dòng là công
 * sức bỏ ra để bảo trì một thứ gần như không đổi. Sửa .env rồi khởi động lại
 * là xong. Khi nào cần biên tập viên tự thêm mà không đụng server thì hẵng
 * chuyển sang bảng.
 *
 * Định dạng: JSON [{"name","url","description"}], hoặc dạng gọn
 * "Tên|https://...,Tên khác|https://..." cho ai ngại viết JSON trong .env.
 */
function parseNetworkSites(raw: string | undefined): NetworkSite[] {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((x) => x && typeof x.name === 'string' && typeof x.url === 'string')
        .map((x) => ({
          name: String(x.name),
          url: String(x.url),
          description: x.description ? String(x.description) : undefined,
        }));
    } catch {
      return [];
    }
  }

  return trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const bar = entry.indexOf('|');
      if (bar < 0) return { name: entry, url: entry };
      return { name: entry.slice(0, bar).trim(), url: entry.slice(bar + 1).trim() };
    })
    .filter((s) => s.name && s.url);
}

export const settings = {
  PROJECT_NAME: process.env.PROJECT_NAME ?? 'Healthcare Forum',
  VERSION: '1.0.0',
  NODE_ENV: process.env.NODE_ENV ?? 'development',

  DATABASE_URL: toPgUrl(
    process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL,
  ),

  JWT_SECRET: process.env.JWT_SECRET?.trim() || DEFAULT_JWT_SECRET,
  JWT_ALGORITHM: 'HS256' as const,
  ACCESS_TOKEN_EXPIRE_MINUTES: Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES ?? 30),
  REFRESH_TOKEN_EXPIRE_DAYS: Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS ?? 7),

  // The Python app shipped allow_origins=["*"] together with
  // allow_credentials=True, which browsers reject and which is unsafe.
  // A literal "*" is now treated as "reflect the configured dev origins".
  CORS_ORIGINS: rawOrigins.includes('*')
    ? ['http://localhost:3000', 'http://localhost:8000']
    : rawOrigins,

  /** Public address of the forum, used by sitemap.xml and robots.txt. */
  SITE_URL: process.env.SITE_URL ?? 'http://localhost:3000',

  /** Tên mạng lưới hiện ở đầu thẻ, ví dụ "Mạng lưới Y tế Việt". */
  NETWORK_NAME: process.env.NETWORK_NAME ?? '',
  /** Mô tả một dòng dưới tên mạng lưới. */
  NETWORK_TAGLINE: process.env.NETWORK_TAGLINE ?? '',
  NETWORK_SITES: parseNetworkSites(process.env.NETWORK_SITES),

  /**
   * Liên kết pháp lý ở chân trang (Điều khoản, Quyền riêng tư, Miễn trừ trách
   * nhiệm...). Dùng chung bộ phân tích với NETWORK_SITES vì cùng một dạng
   * "tên + địa chỉ". Chưa có trang thì để trống — thà chân trang thiếu mục còn
   * hơn có liên kết bấm vào ra trang trắng.
   */
  FOOTER_LINKS: parseNetworkSites(process.env.FOOTER_LINKS),
  /** Địa chỉ liên hệ hiện ở cột "Kết nối". Để trống thì cột đó không hiện. */
  CONTACT_EMAIL: process.env.CONTACT_EMAIL ?? '',

  UPLOAD_DIR: process.env.UPLOAD_DIR ?? 'uploads',
  PORT: Number(process.env.PORT ?? 8000),

  // SQL logging is off unless explicitly asked for. The Python code had
  // echo=True hardcoded, which logged every statement and its parameters.
  DB_ECHO: (process.env.DB_ECHO ?? process.env.SQL_ECHO) === 'true',
  /** Compatibility alias for older deployments; DB_ECHO is canonical. */
  SQL_ECHO: (process.env.DB_ECHO ?? process.env.SQL_ECHO) === 'true',
};

validateProductionConfig({
  environment: settings.NODE_ENV,
  databaseUrl: settings.DATABASE_URL,
  jwtSecret: settings.JWT_SECRET,
  corsOrigins: rawOrigins,
  databaseConfigured,
  jwtConfigured,
  corsConfigured,
});
