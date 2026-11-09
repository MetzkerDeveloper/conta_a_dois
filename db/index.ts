import 'server-only';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
const globalDb = globalThis as typeof globalThis & { contasDb?: Database };

export function getDb(): Database {
  if (globalDb.contasDb) return globalDb.contasDb;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL não configurada.');
  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on('error', () => {
    console.error('Conexão ociosa do banco encerrada inesperadamente.');
  });
  // Neon aceita conexões Postgres nativas; usar URL pooled em ambientes serverless.
  // O driver pg permite transações interativas e locks também no Postgres de teste.
  globalDb.contasDb = drizzle({ client: pool, schema });
  return globalDb.contasDb;
}
