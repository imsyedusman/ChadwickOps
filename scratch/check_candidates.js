
const postgres = require('postgres');
const path = require('path');
const fs = require('fs');

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

async function find() {
    const res = await sql`
        SELECT workguru_id, name, total, actual_hours, raw_status 
        FROM projects 
        WHERE workguru_id IN ('1282332', '1282334', '1282344', '1282348', '1282359')
    `;
    console.log(JSON.stringify(res, null, 2));
    await sql.end();
}

find();
