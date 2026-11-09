import { createRequire } from 'node:module';
import { defineConfig } from 'drizzle-kit';

const { loadEnvConfig } = createRequire(`${process.cwd()}/package.json`)(
  '@next/env',
) as typeof import('@next/env');
loadEnvConfig(process.cwd());
export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? '' },
  strict: true,
});
