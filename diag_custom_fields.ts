import { db } from "./src/db";
import { systemConfig, projects } from "./src/db/schema";
import { WorkGuruClient } from "./src/lib/workguru";
import { decrypt } from "./src/lib/crypto";
import { eq } from "drizzle-orm";
import axios from "axios";

async function runCustomFieldDiag() {
  const projectNumberToTest = "11733-06"; // This one had SOME data in previous tests
  console.log(`[Diag] Starting Dedicated Custom Field Diagnostic for Project: ${projectNumberToTest}`);

  try {
    // 1. Get Credentials
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) {
      console.error("[Diag] ERROR: No API credentials found in DB.");
      return;
    }

    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    // 2. Find Project in DB
    const project = await db.query.projects.findFirst({
      where: eq(projects.projectNumber, projectNumberToTest),
    });

    if (!project) {
        console.error(`[Diag] ERROR: Project ${projectNumberToTest} not found in DB.`);
        return;
    }

    // 3. Authenticate
    const client = new WorkGuruClient(decryptedKey, decryptedSecret);
    await client.authenticate();
    const token = (client as any).token;

    // 4. Test Dedicated Endpoint
    const baseUrl = 'https://api.workguru.io';
    const endpoint = '/api/services/app/CustomField/GetCustomFieldValuesByTypeAndId';
    
    // Testing different 'type' values if 'Project' fails
    const types = ['Project', 'project', 0]; 
    
    for (const type of types) {
        console.log(`\n[Diag] Testing with Type: ${type}`);
        try {
            const response = await axios.get(`${baseUrl}${endpoint}`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                params: { 
                    type: type,
                    id: project.workguruId 
                }
            });

            console.log(`[Diag] SUCCESS for type ${type}: Status ${response.status}`);
            console.log(`[Diag] Response Data:`, JSON.stringify(response.data, null, 2).substring(0, 1000));
            
            if (response.data.result) {
                console.log(`[Diag] Result count: ${response.data.result.length}`);
                response.data.result.forEach((f: any) => {
                    console.log(`- Field: ${f.customField?.name || 'Unknown'} (ID: ${f.customFieldId}), Value: ${f.value}`);
                });
            }
        } catch (error: any) {
            console.error(`[Diag] FAILED for type ${type}: Status ${error.response?.status}`);
            if (error.response?.data) {
                console.error(`[Diag] Error body:`, JSON.stringify(error.response.data));
            }
        }
    }

  } catch (error) {
    console.error("[Diag] Unexpected Error:", error);
  } finally {
    process.exit(0);
  }
}

runCustomFieldDiag();
