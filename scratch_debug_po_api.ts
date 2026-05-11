import { WorkGuruClient } from './src/lib/workguru';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugPoApi() {
    const client = new WorkGuruClient(process.env.WORKGURU_API_KEY!, process.env.WORKGURU_API_SECRET!);
    const poId = '1220671';
    
    console.log(`--- Fetching PO ${poId} raw data ---`);
    const data = await client.getPurchaseOrderById(poId);
    
    // We want to see if supplierName is at the root or inside something else
    console.log(JSON.stringify(data, null, 2));
}

debugPoApi().catch(console.error);
