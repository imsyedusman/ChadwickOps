import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import fs from 'fs';
import path from 'path';

// Manual .env loading fallback for environments where Next.js auto-loading might be delayed or inconsistent
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const env = fs.readFileSync(envPath, 'utf8');
      env.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
          process.env[key.trim()] = value;
        }
      });
    }
  } catch (e) {
    console.error('Failed to manually load .env:', e);
  }
}

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
