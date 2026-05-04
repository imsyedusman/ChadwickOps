import { WorkGuruClient } from '../src/lib/workguru';

async function testTimesheetCost() {
    const client = new WorkGuruClient();
    const workguruId = '1282417'; // Project with known timesheets
    console.log(`Testing Timesheet API for project ${workguruId}...`);
    
    try {
        const tsResponse = await client.getProjectTimeEntries(workguruId);
        const items = tsResponse.result?.items || tsResponse.items || tsResponse.result || [];
        
        console.log(`Found ${items.length} timesheets.`);
        if (items.length > 0) {
            console.log('Sample Timesheet Keys:', Object.keys(items[0]));
            console.log('Sample Timesheet Data:', items[0]);
            console.log('Cost Field:', items[0].cost, items[0].internalCosting, items[0].Cost);
        }

    } catch (e) {
        console.error(e);
    }
}

testTimesheetCost();
