import { db } from "./src/db";
import { systemConfig } from "./src/db/schema";
import { WorkGuruClient } from "./src/lib/workguru";
import { decrypt } from "./src/lib/crypto";
import { eq } from "drizzle-orm";
import axios from "axios";

async function testStrings() {
  try {
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });
    if (!config) return;
    const { apiKey, apiSecret } = config.value as any;
    const client = new WorkGuruClient(decrypt(apiKey), decrypt(apiSecret));
    await client.authenticate();
    const token = (client as any).token;

    const baseUrl = 'https://api.workguru.io';
    const endpoint = '/api/services/app/CustomField/GetCustomFieldValuesByTypeAndId';
    const projectId = "1283320"; // 11733-06
    
    const types = ['Project', 'Job', 'WorkOrder', 'Enquiry', 'Quote', 'Client', 'Supplier', 'Asset'];

    for (const type of types) {
        try {
            const response = await axios.get(`${baseUrl}${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { id: projectId, type: type }
            });
            console.log(`Type "${type}": SUCCESS`);
            console.log(JSON.stringify(response.data.result, null, 2));
        } catch (e: any) {
            console.log(`Type "${type}": FAILED (${e.response?.status})`);
        }
    }

  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testStrings();
