import { db } from "./src/db";
import { systemConfig, projects } from "./src/db/schema";
import { WorkGuruClient } from "./src/lib/workguru";
import { decrypt } from "./src/lib/crypto";
import { eq } from "drizzle-orm";
import axios from "axios";

async function runFinalValidation() {
  console.log("=== STARTING FINAL VALIDATION ===");

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

    // 1. Fetch Definitions
    const fieldRes = await axios.get(`${baseUrl}/api/services/app/CustomField/GetCustomFields`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const fields = fieldRes.data.result?.items || fieldRes.data.result || [];
    
    const bayField = fields.find((f: any) => f.name === 'BayLocation' || f.name === 'Bay Location');
    console.log(`BayLocation ID: ${bayField?.id}`);

    // 2. Find a project that HAS values
    console.log("\nSearching for a project with custom field values...");
    const listRes = await axios.get(`${baseUrl}/api/services/app/Project/GetAllCurrentProjects`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { MaxResultCount: 50 }
    });
    const items = listRes.data.result?.items || [];
    
    const projectWithData = items.find((p: any) => 
        p.customFieldValues && p.customFieldValues.some((v: any) => v.value !== null && v.value !== '')
    );

    if (!projectWithData) {
        console.log("No project with non-empty custom field values found in first 50 results.");
        return;
    }

    console.log(`Testing Project: ${projectWithData.projectNo} (ID: ${projectWithData.id})`);
    
    // 3. Test GetProjectById
    console.log("\n3. Testing GetProjectById...");
    const detailRes = await axios.get(`${baseUrl}/api/services/app/Project/GetProjectById`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { id: projectWithData.id }
    });
    const detail = detailRes.data.result;
    console.log(`GetProjectById customFieldValues count: ${detail.customFieldValues?.length || 0}`);
    detail.customFieldValues?.forEach((v: any) => {
        const def = fields.find((f: any) => f.id === v.customFieldId);
        if (v.value) console.log(`- ID ${v.customFieldId} (${def?.name}): "${v.value}"`);
    });

    // 4. Test Dedicated Endpoint
    console.log("\n4. Testing dedicated endpoint with confirmed project...");
    // We'll try "Project" as string and 0-5 as number
    const variations = ["Project", 0, 1, 2, 3, 4, 5, 6, 7];
    for (const type of variations) {
        try {
            const res = await axios.get(`${baseUrl}/api/services/app/CustomField/GetCustomFieldValuesByTypeAndId`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { id: projectWithData.id, type: type }
            });
            console.log(`Type ${type}: SUCCESS, Results: ${res.data.result?.length || 0}`);
            if (res.data.result?.length > 0) {
                console.log(JSON.stringify(res.data.result, null, 2));
            }
        } catch (e: any) {
            console.log(`Type ${type}: FAILED (${e.response?.status})`);
        }
    }

  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

runFinalValidation();
