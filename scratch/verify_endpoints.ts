
import { WorkGuruClient } from '../src/lib/workguru';
import { db } from '../src/db';
import { systemConfig, projects } from '../src/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { decrypt } from '../src/lib/crypto';
import * as dotenv from 'dotenv';

dotenv.config();

async function getCredentials() {
  const [config] = await db.select()
    .from(systemConfig)
    .where(eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'))
    .limit(1);

  if (!config) {
    throw new Error('No WorkGuru credentials found in system_config');
  }

  const { apiKey, apiSecret } = config.value as any;
  return {
    apiKey: decrypt(apiKey),
    apiSecret: decrypt(apiSecret),
  };
}

async function verify() {
  try {
    const creds = await getCredentials();
    const client = new WorkGuruClient(creds.apiKey, creds.apiSecret);

    // Get 3 active projects from DB
    const activeProjects = await db.select()
      .from(projects)
      .where(and(
        ne(projects.rawStatus, 'Completed'),
        eq(projects.isArchived, false)
      ))
      .limit(3);

    if (activeProjects.length === 0) {
      console.log('No active projects found in DB.');
      return;
    }

    console.log(`Testing with ${activeProjects.length} projects:`);
    for (const p of activeProjects) {
      console.log(`- [${p.workguruId}] ${p.name} (${p.projectNumber})`);
    }

    // Since I don't have the methods in WorkGuruClient yet, I'll call them via axios directly or extend the client
    // For this verification, I'll use the client's internal authentication logic if possible, 
    // or just use the token after authentication.

    await client.authenticate();
    
    // I need to know the exact URLs for these endpoints. 
    // Usually WorkGuru API v1 uses:
    // /api/services/app/ProjectPivotReport/GetWipBasedOnActualsNew
    // /api/services/app/ProjectPivotReport/GetProjectProfitSummaryWithinPeriod
    // /api/services/app/Invoice/GetAllInvoices

    const axios = require('axios');
    const baseUrl = 'https://api.workguru.io';
    const token = (client as any).token;
    const headers = { Authorization: `Bearer ${token}` };

    for (const p of activeProjects) {
      console.log(`\n--- Project: ${p.name} (${p.workguruId}) ---`);

      // 1. GetWipBasedOnActualsNew
      try {
        const wipRes = await axios.get(`${baseUrl}/api/services/app/ProjectPivotReport/GetWipBasedOnActualsNew`, {
          headers,
          params: { ProjectId: p.workguruId }
        });
        console.log('GetWipBasedOnActualsNew:', JSON.stringify(wipRes.data.result, null, 2).substring(0, 500));
      } catch (e: any) {
        console.log('GetWipBasedOnActualsNew Error:', e.response?.status, e.response?.data || e.message);
      }

      // 2. GetProjectProfitSummaryWithinPeriod
      try {
        const profitRes = await axios.get(`${baseUrl}/api/services/app/ProjectPivotReport/GetProjectProfitSummaryWithinPeriod`, {
          headers,
          params: { ProjectId: p.workguruId }
        });
        console.log('GetProjectProfitSummaryWithinPeriod:', JSON.stringify(profitRes.data.result, null, 2).substring(0, 500));
      } catch (e: any) {
        console.log('GetProjectProfitSummaryWithinPeriod Error:', e.response?.status, e.response?.data || e.message);
      }

      // 3. GetAllInvoices
      try {
        const invoiceRes = await axios.get(`${baseUrl}/api/services/app/Invoice/GetAllInvoices`, {
          headers,
          params: { ProjectId: p.workguruId, MaxResultCount: 100 }
        });
        const invoices = invoiceRes.data.result?.items || invoiceRes.data.items || [];
        const nonDraftInvoices = invoices.filter((i: any) => i.status !== 'Draft');
        console.log(`Invoices (Total: ${invoices.length}, Non-Draft: ${nonDraftInvoices.length})`);
        nonDraftInvoices.forEach((i: any) => {
            console.log(`  - Inv #${i.invoiceNumber}: ${i.total} (${i.status})`);
        });
      } catch (e: any) {
        console.log('GetAllInvoices Error:', e.response?.status, e.response?.data || e.message);
      }
    }

  } catch (error) {
    console.error('Verification failed:', error);
  }
}

verify();
