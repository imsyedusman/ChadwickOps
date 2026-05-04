
const postgres = require('postgres');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
        }
    });
}

async function run() {
    const sql = postgres(process.env.DATABASE_URL);
    try {
        const res = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
        console.log('Tables:', res.map(r => r.table_name));
        
        const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'time_entries'`;
        console.log('time_entries columns:', cols.map(c => c.column_name));
    } finally {
        await sql.end();
    }
}

run();
