import 'dotenv/config';

function toPgUrl(raw: string): string {
  // The Python stack used SQLAlchemy's driver-qualified URL
  // (postgresql+asyncpg://). node-postgres wants a plain postgres:// URL.
  return raw.replace(/^postgresql\+asyncpg:\/\//, 'postgresql://');
}

function parseOrigins(raw: string | undefined): string[] {
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

const rawOrigins = parseOrigins(process.env.BACKEND_CORS_ORIGINS);

export const settings = {
  PROJECT_NAME: process.env.PROJECT_NAME ?? 'Healthcare Forum',
  VERSION: '1.0.0',
  NODE_ENV: process.env.NODE_ENV ?? 'development',

  DATABASE_URL: toPgUrl(
    process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@db:5432/healthcare_forum',
  ),

  JWT_SECRET: process.env.JWT_SECRET ?? 'supersecret_jwt_key_here',
  JWT_ALGORITHM: 'HS256' as const,
  ACCESS_TOKEN_EXPIRE_MINUTES: Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES ?? 30),
  REFRESH_TOKEN_EXPIRE_DAYS: Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS ?? 7),

  // The Python app shipped allow_origins=["*"] together with
  // allow_credentials=True, which browsers reject and which is unsafe.
  // A literal "*" is now treated as "reflect the configured dev origins".
  CORS_ORIGINS: rawOrigins.includes('*')
    ? ['http://localhost:3000', 'http://localhost:8000']
    : rawOrigins,

  UPLOAD_DIR: process.env.UPLOAD_DIR ?? 'uploads',
  PORT: Number(process.env.PORT ?? 8000),

  // SQL logging is off unless explicitly asked for. The Python code had
  // echo=True hardcoded, which logged every statement and its parameters.
  SQL_ECHO: process.env.SQL_ECHO === 'true',
};

if (settings.NODE_ENV === 'production' && settings.JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET must be at least 32 characters in production. Refusing to start with a weak signing key.',
  );
}
