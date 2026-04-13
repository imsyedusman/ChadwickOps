import { db } from "./src/db";
import { systemConfig, projects } from "./src/db/schema";
import { WorkGuruClient } from "./src/lib/workguru";
import { decrypt } from "./src/lib/crypto";
import { eq } from "drizzle-orm";
import axios from "axios";

async function findEntityType() {
  const projectNumberToTest = "11733-06";
  try {
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });
    if (!config) return;
    const { apiKey, apiSecret } = config.value as any;
    const client = new WorkGuruClient(decrypt(apiKey), decrypt(apiSecret));
    await client.authenticate();
    const token = (client as any).token;

    const project = await db.query.projects.findFirst({
        where: eq(projects.projectNumber, projectNumberToTest),
    });
    if (!project) return;

    const baseUrl = 'https://api.workguru.io';
    const endpoints = [
        '/api/services/app/CustomField/GetCustomFieldValuesByTypeAndId',
        '/api/services/app/CustomField/GetCustomFieldValuesByIdAndType'
    ];

    for (const endpoint of endpoints) {
        console.log(`\n--- Testing Endpoint: ${endpoint} ---`);
        for (let type = 0; type <= 10; type++) {
            try {
                const response = await axios.get(`${baseUrl}${endpoint}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { id: project.workguruId, type: type }
                });
                console.log(`Endpoint ${endpoint} with Type ${type}: SUCCESS`);
                console.log(JSON.stringify(response.data.result, null, 2));
                if (response.data.result && response.data.result.length > 0) {
                    process.exit(0); // Found it!
                }
            } catch (e: any) {
                // console.log(`Type ${type}: FAILED (${e.response?.status})`);
            }
        }
    }

  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

findEntityType();
