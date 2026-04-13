const postgres = require('postgres');
const crypto = require('crypto');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

const sql = postgres(DATABASE_URL);

/**
 * Decrypts text using the same logic as standard implementation
 * @param {string} text Format "iv:encrypted"
 */
function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  try {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return text;
  }
}

async function getCreds() {
  console.log("Extracting WorkGuru credentials...");
  try {
    const res = await sql`SELECT value FROM system_config WHERE key = 'WORKGURU_API_CREDENTIALS' LIMIT 1`;
    if (res.length === 0) {
      console.log("No credentials found.");
      return null;
    }
    const { apiKey, apiSecret } = res[0].value;
    return {
      apiKey: decrypt(apiKey),
      apiSecret: decrypt(apiSecret)
    };
  } catch (err) {
    console.error("Failed to extract creds:", err.message);
    return null;
  } finally {
    await sql.end();
  }
}

module.exports = { getCreds };

if (require.main === module) {
  getCreds().then(c => console.log("Extracted:", c ? "SUCCESS" : "FAILED"));
}
