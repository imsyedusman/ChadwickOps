import { db } from "./src/db";
import { systemConfig, projects } from "./src/db/schema";
import { WorkGuruClient } from "./src/lib/workguru";
import { decrypt } from "./src/lib/crypto";
import { eq } from "drizzle-orm";

async function runDeepSyncDiag() {
  const projectNumberToTest = "11733-06";
  console.log(`[Diag] Starting Deep Sync Diagnostic for Project: ${projectNumberToTest}`);

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
      console.error(`[Diag] ERROR: Project ${projectNumberToTest} not found in local database.`);
      // List some active projects to help
      const someProjects = await db.select({ projectNumber: projects.projectNumber, workguruId: projects.workguruId })
        .from(projects)
        .limit(5);
      console.log("[Diag] First 5 projects in DB:", someProjects);
      return;
    }

    console.log(`[Diag] DB Record: ID=${project.id}, WorkGuruID=${project.workguruId}, ProjectNumber=${project.projectNumber}`);

    // 3. Setup Client
    const client = new WorkGuruClient(decryptedKey, decryptedSecret);
    
    // 4. Test API Request
    const baseUrl = 'https://api.workguru.io';
    const endpoint = '/api/services/app/Project/GetProjectById';
    const params = { id: project.workguruId };
    const fullUrl = `${baseUrl}${endpoint}?id=${params.id}`;

    console.log(`[Diag] Attempting Deep Sync Request:`);
    console.log(`[Diag] Full request URL: ${fullUrl}`);
    console.log(`[Diag] Query parameters: ${JSON.stringify(params)}`);
    console.log(`[Diag] Identifier being used (projectId): ${project.workguruId}`);

    try {
      const axios = require('axios');
      const headers = await client['getAuthHeader']();
      const response = await axios.get(fullUrl, { headers });
      const responseData = response.data;
      console.log(`[Diag] SUCCESS: Request returned status ${response.status}`);
      console.log(`[Diag] Response Summary:`, JSON.stringify(response).substring(0, 500));
      
      // Check for custom fields
      const result = response?.result || response;
      const fs = require('fs');
      fs.writeFileSync('diag_deep_response.json', JSON.stringify(result, null, 2));
      console.log(`[Diag] Full response saved to diag_deep_response.json`);
      console.log(`[Diag] Custom Fields Array:`, JSON.stringify(result?.customFields || result?.CustomFields || []));
      
      if (Array.isArray(result?.customFields)) {
          const bay = result.customFields.find((f: any) => f.key === 'BayLocation' || f.name === 'BayLocation');
          console.log(`[Diag] Found BayLocation in array:`, JSON.stringify(bay));
      }
    } catch (error: any) {
      console.error(`[Diag] FAILED: Request failed with status code ${error.response?.status || 'unknown'}`);
      console.error(`[Diag] Error Message: ${error.message}`);
      if (error.response?.data) {
          console.error(`[Diag] Error Data: ${JSON.stringify(error.response.data)}`);
      }
    }

  } catch (error) {
    console.error("[Diag] Unexpected Error:", error);
  } finally {
    process.exit(0);
  }
}

runDeepSyncDiag();
