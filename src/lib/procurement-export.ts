import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { 
    ProcurementDashboardItem, 
    BackorderItem, 
    SupplierRiskItem 
} from '@/app/actions/procurement';
import { formatProcurementDate } from './procurement-logic';

export function generateProjectsExport(data: ProcurementDashboardItem[], formatType: 'xlsx' | 'csv') {
    const headers = [
        'Project Number',
        'Project Name',
        'Client',
        'Delivery Date',
        'Procurement Status',
        'Delayed Items Count',
        'Missing ETA Count',
        'Partial Deliveries Count',
        'Active Supplier Issues',
        'PO Count',
        'Action Required',
        'Linked Suppliers',
        'WorkGuru Project Link'
    ];

    const rows = data.map(item => [
        item.projectNumber,
        item.projectName,
        item.clientName,
        formatProcurementDate(item.deliveryDate),
        item.action.label,
        item.stats.delayedLines,
        item.stats.missingEtaLines,
        item.stats.outstandingLines - item.stats.delayedLines - item.stats.missingEtaLines, // Partial Deliveries
        item.action.type === 'ACTION_ESCALATE' ? 1 : 0, // Active Supplier Issues
        item.stats.totalLines, // PO Count (Lines for now)
        item.action.actionRequired,
        item.supplierNames.join(', '),
        item.projectUrl
    ]);

    return createWorkbook(headers, rows, 'procurement_projects', formatType);
}

export function generateBackordersExport(data: BackorderItem[], formatType: 'xlsx' | 'csv') {
    const headers = [
        'Project Number',
        'Project Name',
        'Supplier',
        'PO Number',
        'Material Description',
        'Ordered Qty',
        'Received Qty',
        'Outstanding Qty',
        'ETA',
        'Days Outstanding',
        'Procurement Status',
        'Action Required',
        'WorkGuru PO Link',
        'WorkGuru Project Link'
    ];

    const rows = data.map(item => [
        item.projectNumber,
        item.projectName,
        item.supplierName,
        item.poNumber,
        item.materialName,
        item.quantity,
        item.receivedQuantity,
        item.outstandingQuantity,
        formatProcurementDate(item.expectedDate),
        item.daysOutstanding,
        item.action.label,
        item.action.actionRequired,
        `https://app.workguru.io/App/PurchaseOrders/Details/${item.poWorkguruId}`,
        item.projectUrl
    ]);

    return createWorkbook(headers, rows, 'procurement_backorders', formatType);
}

export function generateSuppliersExport(data: SupplierRiskItem[], formatType: 'xlsx' | 'csv') {
    const headers = [
        'Supplier Name',
        'Active Projects',
        'Outstanding Material Lines',
        'Delayed Deliveries',
        'Missing ETA Count',
        'Partial Deliveries',
        'Delivery Risks',
        'Projects Impacted',
        'Oldest Delay (Days)',
        'Highest Risk Project',
        'Procurement Summary Status'
    ];

    const rows = data.map(item => [
        item.supplierName,
        item.affectedProjectCount,
        item.totalLineCount,
        item.delayedLineCount,
        item.missingEtaCount,
        item.totalLineCount - item.delayedLineCount - item.missingEtaCount - item.deliveryRiskCount, // Partial Deliveries
        item.deliveryRiskCount,
        item.affectedProjectCount, // Projects Impacted
        item.oldestDelayDays,
        item.highestRiskProject,
        item.deliveryRiskCount > 0 ? 'High Risk' : item.delayedLineCount > 0 ? 'Action Required' : 'On Track'
    ]);

    return createWorkbook(headers, rows, 'supplier_delays', formatType);
}

export function filterProjects(data: ProcurementDashboardItem[], query: string) {
    if (!query) return data;
    const q = query.toLowerCase();
    return data.filter(p => 
        p.projectNumber.toLowerCase().includes(q) ||
        p.projectName.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q)
    );
}

export function filterBackorders(data: BackorderItem[], query: string, filter: string, supplier: string | null) {
    let filtered = data;
    if (query) {
        const q = query.toLowerCase();
        filtered = filtered.filter(b => 
            b.projectNumber.toLowerCase().includes(q) ||
            b.projectName.toLowerCase().includes(q) ||
            b.supplierName.toLowerCase().includes(q) ||
            b.poNumber.toLowerCase().includes(q) ||
            b.materialName.toLowerCase().includes(q)
        );
    }
    
    if (supplier) {
        filtered = filtered.filter(b => b.supplierName === supplier);
    }

    if (filter === 'PROBLEMS') {
        filtered = filtered.filter(b => b.action.severity < 4);
    } else if (filter !== 'ALL' && filter) {
        filtered = filtered.filter(b => b.action.type === filter);
    }

    return filtered;
}

export function filterSuppliers(data: SupplierRiskItem[], query: string) {
    if (!query) return data;
    const q = query.toLowerCase();
    return data.filter(s => s.supplierName.toLowerCase().includes(q));
}

export function sortData(data: any[], key: string, order: 'asc' | 'desc') {
    const direction = order === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
        // Basic sort logic, can be expanded to match UI perfectly
        if (key === 'action' || key === 'severity') {
            const sevA = a.action?.severity ?? a.severity ?? 0;
            const sevB = b.action?.severity ?? b.severity ?? 0;
            return (sevA - sevB) * direction;
        }
        
        const valA = a[key];
        const valB = b[key];

        if (typeof valA === 'string') return valA.localeCompare(valB) * direction;
        if (typeof valA === 'number') return (valA - valB) * direction;
        return 0;
    });
}

function createWorkbook(headers: string[], rows: any[][], fileNameBase: string, formatType: 'xlsx' | 'csv') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    // Set column widths for Excel
    if (formatType === 'xlsx') {
        const maxWidths = headers.map((h, i) => {
            const colRows = rows.map(r => String(r[i] || '').length);
            return Math.max(h.length, ...colRows) + 2;
        });
        ws['!cols'] = maxWidths.map(w => ({ wch: w }));
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    const dateStr = format(new Date(), 'dd-MMM-yyyy');
    const fileName = `${fileNameBase}_${dateStr}.${formatType}`;

    let data: Uint8Array;
    let contentType: string;

    if (formatType === 'csv') {
        data = new TextEncoder().encode(XLSX.utils.sheet_to_csv(ws));
        contentType = 'text/csv';
    } else {
        data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    return { data, fileName, contentType };
}
