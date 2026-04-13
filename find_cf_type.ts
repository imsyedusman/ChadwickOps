import { db } from "./src/db";
import { systemConfig } from "./src/db/schema";
import { WorkGuruClient } from "./src/lib/workguru";
import { decrypt } from "./src/lib/crypto";
import { eq } from "drizzle-orm";
import axios from "axios";

async function getCustomFields() {
  try {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) return;

    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const client = new WorkGuruClient(decryptedKey, decryptedSecret);
    await client.authenticate();
    const token = (client as any).token;

    const baseUrl = 'https://api.workguru.io';
    const endpoint = '/api/services/app/CustomField/GetCustomFields';

    const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    const fields = response.data.result?.items || response.data.result || [];
    console.log(`Found ${fields.length} custom fields.`);
    
    // Group by type if possible
    const types = new Set(fields.map((f: any) => f.type));
    console.log('Available types:', Array.from(types));

    fields.forEach((f: any) => {
        if (['BayLocation', 'ClientDrawingApprovalDate', 'DrawingSubmittedDate', 'Bay Location'].includes(f.name)) {
            console.log(`- ${f.name} (Key: ${f.key}, Type: ${f.type}, ID: ${f.id})`);
        }
    });

    // Also try GetProjectAndQuoteCustomFieldGroups
    const groupEndpoint = '/api/services/app/CustomField/GetProjectAndQuoteCustomFieldGroups';
    const groupRes = await axios.get(`${baseUrl}${groupEndpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log('\nProject/Quote Groups:', JSON.stringify(groupRes.data.result, null, 2));

  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

getCustomFields();
