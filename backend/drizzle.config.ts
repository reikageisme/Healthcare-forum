import type { Config } from 'drizzle-kit';
import 'dotenv/config';

const url = (process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@db:5432/healthcare_forum')
  .replace(/^postgresql\+asyncpg:\/\//, 'postgresql://');

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
} satisfies Config;
