const axios = require('axios');
const crypto = require('crypto');

// Values directly from .env and knowledge
const DATABASE_URL = 'postgresql://chadwick_user:Developer2k26!@localhost:5432/chadwick_ops';
const ENCRYPTION_KEY = '8a07cf0a4e89f1b4e927e4c6ea2eafbd';

function decrypt(text) {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

async function go() {
  const apiKeyEnc = "460d36746860d5ed0d8745582f3c306d:b8d8123282f1b4e927e4c6ea2eafbd7e66df912efc64b5e7d69288e0292857754b5dfd410ae7236e76cf1ba9381c62586616aed424e757ae05e3f947e246a480";
  const apiSecretEnc = "5d54fa5789f2b8d0ca28380e224e756c:a89ed8338e9255c2d3c34e857463f82e584ec6480927e4c6fbd7ea2882f038d827e4c6fbd7ea2882f038d827e4c6fbd7ea2882f038d827e4c6fbd7ea28...";
  // Note: I'll need to grab the actual full strings if I can.
}
