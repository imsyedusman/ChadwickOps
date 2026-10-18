import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';


const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('CRITICAL: DATABASE_URL is not set in environment variables.');
}

declare global {
  // eslint-disable-next-line no-var
  var _postgresClient: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var _drizzleDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

const client = globalThis._postgresClient ?? postgres(databaseUrl || 'postgres://localhost:5432/placeholder', {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
});

if (process.env.NODE_ENV !== 'production') {
  globalThis._postgresClient = client;
}

export const db = globalThis._drizzleDb ?? drizzle(client, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalThis._drizzleDb = db;
}
