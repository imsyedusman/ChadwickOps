
import fs from 'fs';
import path from 'path';

// Manual .env loading for scripts
function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;
            const index = trimmedLine.indexOf('=');
            if (index !== -1) {
                const key = trimmedLine.substring(0, index).trim();
                const value = trimmedLine.substring(index + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
                process.env[key] = value;
            }
        });
    }
}

loadEnv();

import { db } from '../src/db';
import { projects } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';

async function main() {
    const zeroProjects = await db.query.projects.findMany({
        where: eq(projects.total, 0),
        limit: 20
    });

    console.log(`Found ${zeroProjects.length} projects with $0 value in DB:`);
    zeroProjects.forEach(p => {
        console.log(`- ${p.projectNumber}: ${p.name} (Status: ${p.rawStatus})`);
    });

    process.exit(0);
}

main().catch(console.error);
