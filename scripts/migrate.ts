import { createRequire } from 'node:module';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const { loadEnvConfig } = createRequire(`${process.cwd()}/package.json`)(
  '@next/env',
) as typeof import('@next/env');
loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString)
  throw new Error(
    'Configure DATABASE_URL_UNPOOLED em .env.local para aplicar as migrations.',
  );
const pool = new Pool({ connectionString, max: 1 });
try {
  await migrate(drizzle({ client: pool }), {
    migrationsFolder: './db/migrations',
  });
  console.log('Migrations aplicadas.');
} catch {
  console.error(
    'Não foi possível aplicar as migrations. Verifique a conexão e o estado do banco.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
