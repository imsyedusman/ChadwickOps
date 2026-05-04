import { getJobCostReport } from '../src/app/actions/financials';
import { format } from 'date-fns';

async function test() {
    const month = format(new Date(), 'yyyy-MM');
    console.log('Testing month:', month);
    try {
        const data = await getJobCostReport(month);
        console.log('Total projects returned:', data.length);
        console.log('Projects with financials:', data.filter(p => p.financials !== null).length);
        if (data.length > 0) {
            console.log('First project:', JSON.stringify(data[0], null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

test();
