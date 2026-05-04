import { WorkGuruClient } from '../src/lib/workguru';

async function testApi() {
    const client = new WorkGuruClient();
    const workguruId = '1284281'; 
    console.log(`Testing API for project ${workguruId}...`);
    
    try {
        const details = await client.getProjectDetails(workguruId);
        const result = details.result || details;
        
        console.log('Keys in Project Details:', Object.keys(result));
        
        console.log('\ntimeSheets:', result.timeSheets ? result.timeSheets.length : 'MISSING');
        console.log('purchaseOrders:', result.purchaseOrders ? result.purchaseOrders.length : 'MISSING');
        console.log('invoices:', result.invoices ? result.invoices.length : 'MISSING');
        
        if (result.timeSheets && result.timeSheets.length > 0) {
            console.log('\nSample Timesheet:', result.timeSheets[0]);
        }
        if (result.purchaseOrders && result.purchaseOrders.length > 0) {
            console.log('\nSample PO:', result.purchaseOrders[0]);
        }
        if (result.invoices && result.invoices.length > 0) {
            console.log('\nSample Invoice:', result.invoices[0]);
        }

    } catch (e) {
        console.error(e);
    }
}

testApi();
