import { NextRequest, NextResponse } from 'next/server';
import { 
    getProcurementDashboardData, 
    getBackordersData, 
    getSupplierRiskData 
} from '@/app/actions/procurement';
import { 
    generateProjectsExport, 
    generateBackordersExport, 
    generateSuppliersExport,
    filterProjects,
    filterBackorders,
    filterSuppliers,
    sortData
} from '@/lib/procurement-export';

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const tab = searchParams.get('tab') || 'projects';
        const format = (searchParams.get('format') || 'xlsx') as 'xlsx' | 'csv';
        const query = searchParams.get('query') || '';
        const filter = searchParams.get('filter') || 'ALL';
        const supplier = searchParams.get('supplier') || null;
        const sortKey = searchParams.get('sortKey') || 'action';
        const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';

        let exportData: { buffer: Buffer; fileName: string; contentType: string };

        if (tab === 'projects') {
            const result = await getProcurementDashboardData();
            if (!result.success || !result.data) throw new Error(result.error);
            
            const filtered = filterProjects(result.data, query);
            const sorted = sortData(filtered, sortKey, sortOrder);
            exportData = generateProjectsExport(sorted, format);

        } else if (tab === 'backorders') {
            const result = await getBackordersData();
            if (!result.success || !result.data) throw new Error(result.error);
            
            const filtered = filterBackorders(result.data, query, filter, supplier);
            const sorted = sortData(filtered, sortKey, sortOrder);
            exportData = generateBackordersExport(sorted, format);

        } else if (tab === 'suppliers') {
            const result = await getSupplierRiskData();
            if (!result.success || !result.data) throw new Error(result.error);
            
            const filtered = filterSuppliers(result.data, query);
            const sorted = sortData(filtered, sortKey, sortOrder);
            exportData = generateSuppliersExport(sorted, format);

        } else {
            return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
        }

        return new Response(exportData.buffer, {
            headers: {
                'Content-Type': exportData.contentType,
                'Content-Disposition': `attachment; filename="${exportData.fileName}"`,
            },
        });

    } catch (error: any) {
        console.error('Export failed:', error);
        return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 });
    }
}
