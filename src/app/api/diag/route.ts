import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemConfig, projects } from '@/db/schema';
import { decrypt } from '@/lib/crypto';
import { eq, isNotNull } from 'drizzle-orm';
import { SyncService } from '@/lib/sync';
import axios from 'axios';

export async function GET() {
  try {
    const configRes = await db.select().from(systemConfig).where(eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS')).limit(1);
    const config = configRes[0];

    if (!config) return NextResponse.json({ error: 'No config' });
    const { apiKey, apiSecret } = config.value as { apiKey: string, apiSecret: string };
    const syncService = new SyncService(decrypt(apiKey), decrypt(apiSecret));
    
    // Fetch one specific project with workguruId to see its details
    const projectsInDb = await db.select().from(projects).limit(1);
    const workguruId = projectsInDb[0].workguruId;
    
    const tokenRes = await axios.post('https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth', {
      apiKey: decrypt(apiKey),
      secret: decrypt(apiSecret),
    });
    const token = tokenRes.data.accessToken;

    const pUrl = `https://api.workguru.io/api/services/app/Project/GetProjectById?id=${workguruId}`;
    const pRes = await axios.get(pUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const project = pRes.data.result;

    return NextResponse.json({
      success: true,
      workguruId,
      projectName: projectsInDb[0].name,
      keys: Object.keys(project),
      customFields: project.customFields,
      customFieldValues: project.customFieldValues,
      fullProject: project // We need to see why BayLocation is null
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
}
