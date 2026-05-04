
const postgres = require('postgres');
const path = require('path');
const fs = require('fs');

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
        }
    });
}

const sql = postgres(process.env.DATABASE_URL);

async function run() {
    try {
        const res = await sql`SELECT * FROM projects LIMIT 1`;
        console.log('Project table row:', JSON.stringify(res[0], null, 2));
        
        const timeRes = await sql`SELECT * FROM time_entries LIMIT 1`;
        console.log('Time entry table row:', JSON.stringify(timeRes[0], null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await sql.end();
    }
}

run();
