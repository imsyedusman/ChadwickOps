import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';

loadEnvConfig(resolve(__dirname, '..'));

import { WorkGuruClient } from '../src/lib/workguru';
import { db } from '../src/db';
import { systemConfig } from '../src/db/schema';
import { decrypt } from '../src/lib/crypto';
import { eq } from 'drizzle-orm';
import axios from 'axios';

async function run() {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
  });

  if (!config) {
    console.error('WorkGuru API Credentials not configured in DB');
    process.exit(1);
  }

  const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
  const key = decrypt(apiKey);
  const secret = decrypt(apiSecret);
  
  const client = new WorkGuruClient(key, secret);
  
  // Expose the private method using ts-ignore for testing
  // @ts-ignore
  const headers = await client.getAuthHeader();
  
  const testId = 1266736;
  console.log(`Testing with known WorkGuru Project ID: ${testId}`);
  
  const baseUrl = 'https://api.workguru.io/api/services/app';

  const fs = require('fs');
  const results: any = {};

  try {
    const { data } = await axios.get(`${baseUrl}/Project/GetAllTasksByProjectId?id=${testId}`, { headers });
    results.tasks = data;
  } catch (e: any) {
    results.tasks = { error: e.response?.data || e.message };
  }

  try {
    const { data } = await axios.get(`${baseUrl}/TimeSheet/GetAllTimeSheetByProjectId?id=${testId}`, { headers });
    results.timesheets = data;
  } catch (e: any) {
    results.timesheets = { error: e.response?.data || e.message };
  }
  
  fs.writeFileSync('tmp/output.json', JSON.stringify(results, null, 2));
  console.log('Done writing to tmp/output.json');
  process.exit(0);
}

run().catch(console.error);
