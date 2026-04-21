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
    
    // TRACE: Project 12394-02
    const workguruId = '854271'; // Assuming this is the ID, let's try to find it first or use a search
    
    // Better: Find it by number in the DB if possible, but let's try to fetch it from API directly if we can't find it
    const targetProject = await db.query.projects.findFirst({
        where: eq(projects.projectNumber, '12394-02')
    });
    
    const finalWorkguruId = targetProject?.workguruId || '854271'; 
    
    const tokenRes = await axios.post('https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth', {
      apiKey: decrypt(apiKey),
      secret: decrypt(apiSecret),
    });
    const token = tokenRes.data.accessToken;

    const pUrl = `https://api.workguru.io/api/services/app/Project/GetProjectById?id=${finalWorkguruId}`;
    const pRes = await axios.get(pUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const project = pRes.data.result;
    const lineItems = project.productLineItems || project.ProductLineItems || [];
    
    let calculatedTotal = 0;
    const itemsTrace = lineItems.map((li: any) => {
        const price = Number(li.unitAmount || li.unitPrice || li.UnitPrice || 0);
        const qty = Number(li.quantity || li.Quantity || 0);
        const lineTotal = Number(li.lineTotal || li.total || li.Total || (price * qty));
        calculatedTotal += lineTotal;
        return {
            name: li.name || li.Name,
            price,
            qty,
            lineTotal
        };
    });

    let syncLogicTotal = Number(project.total || project.Total || 0);
    const initialApiTotal = syncLogicTotal;
    let fallbackTriggered = false;
    if (syncLogicTotal === 0) {
        fallbackTriggered = true;
        syncLogicTotal = calculatedTotal;
    }

    return NextResponse.json({
      success: true,
      workguruId: finalWorkguruId,
      projectNumber: targetProject?.projectNumber,
      projectName: targetProject?.name,
      storedTotal: targetProject?.total,
      apiTotal: initialApiTotal,
      fallbackTriggered,
      syncLogicTotal,
      calculatedTotal,
      lineItemsCount: lineItems.length,
      itemsTrace,
      fullProject: project 
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({ error: message, stack }, { status: 500 });
  }
}
