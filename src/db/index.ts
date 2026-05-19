import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';


const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('CRITICAL: DATABASE_URL is not set in environment variables.');
}

const client = postgres(databaseUrl || 'postgres://localhost:5432/placeholder', {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
});

export const db = drizzle(client, { schema });
