import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemConfig } from '@/db/schema';
import { decrypt } from '@/lib/crypto';
import { eq } from 'drizzle-orm';
import axios from 'axios';

export async function GET() {
  try {
    const configRes = await db.select().from(systemConfig).where(eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS')).limit(1);
    const config = configRes[0];
    if (!config) return NextResponse.json({ error: 'No config' });
    
    const { apiKey, apiSecret } = config.value as { apiKey: string, apiSecret: string };
    const tokenRes = await axios.post('https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth', {
      apiKey: decrypt(apiKey),
      secret: decrypt(apiSecret),
    });
    
    const token = tokenRes.data.accessToken;
    const response = await axios.get('https://api.workguru.io/api/services/app/Project/GetAllCurrentProjects', {
      headers: { Authorization: `Bearer ${token}` },
      params: { MaxResultCount: 1 }
    });

    const project = response.data.result.items[0];
    
    // Deep search helper
    const findKeys = (obj: unknown, term: string, path: string = ''): unknown[] => {
      let results: unknown[] = [];
      if (!obj || typeof obj !== 'object') return results;
      for (const [key, val] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        if (key.toLowerCase().includes(term.toLowerCase())) {
          results.push({ path: fullPath, val });
        }
        if (typeof val === 'object' && val !== null) {
          results = results.concat(findKeys(val, term, fullPath));
        }
      }
      return results;
    };

    const bayFindings = findKeys(project, 'bay');
    const locationFindings = findKeys(project, 'location');

    return NextResponse.json({
      keys: Object.keys(project),
      bayFindings,
      locationFindings,
      fullProject: project
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const data = (error as { response?: { data?: unknown } })?.response?.data;
    return NextResponse.json({ error: message, data });
  }
}
