import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  // During build, environment variables might be missing. 
  // We provide a fallback or throw a clearer error if this is required at runtime.
  if (process.env.NODE_ENV === 'production') {
    console.warn('DATABASE_URL is not set. Database connection will fail at runtime.');
  }
}

const client = postgres(databaseUrl || 'postgres://localhost:5432/placeholder');
export const db = drizzle(client, { schema });
