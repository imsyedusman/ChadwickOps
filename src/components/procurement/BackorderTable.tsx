"use client";

import { BackorderItem } from "@/app/actions/procurement";
import { RiskBadge } from "./RiskBadge";
import { formatProcurementDate } from "@/lib/procurement-logic";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Package2, ArrowRight, ExternalLink, Filter, Search, ArrowUpDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";

interface BackorderTableProps {
  items: BackorderItem[];
  isLoading?: boolean;
  onFilterChange?: (filter: string) => void;
  activeFilter?: string;
  onProjectClick?: (id: number) => void;
  onSupplierClick?: (name: string) => void;
  onSort?: (key: string) => void;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
}

export function BackorderTable({ 
    items, 
    isLoading, 
    onFilterChange, 
    activeFilter,
    onProjectClick,
    onSupplierClick,
    onSort,
    sortKey,
    sortOrder
}: BackorderTableProps) {
  if (isLoading) {
    return <div className="h-64 flex items-center justify-center text-slate-400 font-medium">Loading backorders...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-100 rounded-xl">
        <Package2 className="h-8 w-8 opacity-20" />
        <span className="font-medium tracking-tight">No backorders currently found.</span>
      </div>
    );
  }

  const SortIcon = ({ k }: { k: string }) => {
    if (sortKey !== k) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />;
    return <ArrowUpDown className={cn("ml-2 h-3 w-3 text-brand", sortOrder === 'desc' ? "rotate-180" : "")} />;
  };

  return (
    <div className="space-y-4 w-full">
        {/* Compact Filter Bar */}
        <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 border-r border-slate-200 pr-6">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-2">
                        <Filter className="h-3 w-3" />
                        Status:
                    </span>
                    <div className="flex items-center gap-1">
                        {[
                            { id: 'ALL', label: 'All' },
                            { id: 'PROBLEMS', label: 'Problems' },
                            { id: 'ACTION_ESCALATE', label: 'Delivery Risks' },
                            { id: 'ACTION_FOLLOW_UP', label: 'Late Deliveries' },
                            { id: 'ACTION_CONFIRM_ETA', label: 'Missing ETA' }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => onFilterChange?.(f.id)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all whitespace-nowrap",
                                    activeFilter === f.id 
                                        ? "bg-slate-900 text-white shadow-md" 
                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                )}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-tight whitespace-nowrap">
                    Displaying {items.length} items
                </div>
            </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <Table className="w-full">
                <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-slate-200">
                        <TableHead 
                            className="w-[180px] text-[10px] font-bold uppercase tracking-widest text-slate-500 py-5 pl-6 cursor-pointer group whitespace-nowrap"
                            onClick={() => onSort?.('action')}
                        >
                            <div className="flex items-center">
                                Status
                                <SortIcon k="action" />
                            </div>
                        </TableHead>
                        <TableHead 
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer group whitespace-nowrap"
                            onClick={() => onSort?.('materialName')}
                        >
                            <div className="flex items-center">
                                Material Description
                                <SortIcon k="materialName" />
                            </div>
                        </TableHead>
                        <TableHead 
                            className="w-[200px] text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer group whitespace-nowrap"
                            onClick={() => onSort?.('projectName')}
                        >
                            <div className="flex items-center">
                                Impacted Project
                                <SortIcon k="projectName" />
                            </div>
                        </TableHead>
                        <TableHead 
                            className="w-[200px] text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer group whitespace-nowrap"
                            onClick={() => onSort?.('supplierName')}
                        >
                            <div className="flex items-center">
                                Supplier / PO
                                <SortIcon k="supplierName" />
                            </div>
                        </TableHead>
                        <TableHead 
                            className="w-[140px] text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer group whitespace-nowrap"
                            onClick={() => onSort?.('quantity')}
                        >
                            <div className="flex items-center justify-end">
                                Received vs Ordered
                                <SortIcon k="quantity" />
                            </div>
                        </TableHead>
                        <TableHead 
                            className="w-[160px] text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 pr-6 cursor-pointer group whitespace-nowrap"
                            onClick={() => onSort?.('expectedDate')}
                        >
                            <div className="flex items-center justify-end">
                                Expected Date
                                <SortIcon k="expectedDate" />
                            </div>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => (
                        <TableRow 
                            key={item.id} 
                            className={cn(
                                "group transition-colors border-slate-100",
                                item.action.severity === 1 ? "bg-red-50/10 hover:bg-red-50/30" : "hover:bg-slate-50/50"
                            )}
                        >
                            <TableCell className="py-6 pl-6">
                                <RiskBadge action={item.action} />
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1 pr-4">
                                    <span className="text-[13px] font-semibold text-slate-900 group-hover:text-brand transition-colors leading-tight">
                                        {item.materialName}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        REF: {item.id}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div 
                                    className="flex flex-col cursor-pointer group/link gap-0.5"
                                    onClick={() => onProjectClick?.(parseInt(item.id))}
                                >
                                    <div className="flex items-center gap-1">
                                        <span className="text-sm font-semibold text-slate-700 group-hover/link:text-brand transition-colors">
                                            {item.projectNumber}
                                        </span>
                                        <ExternalLink className="h-3 w-3 text-slate-300 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium truncate max-w-[180px]">
                                        {item.projectName}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div 
                                    className="flex flex-col cursor-pointer group/link gap-0.5"
                                    onClick={() => onSupplierClick?.(item.supplierName)}
                                >
                                    <div className="flex items-center gap-1">
                                        <span className="text-sm font-semibold text-slate-700 group-hover/link:text-brand transition-colors">
                                            {item.supplierName}
                                        </span>
                                        <ArrowRight className="h-3 w-3 text-slate-300 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5 group/po">
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    PO: {item.poNumber}
                                                </span>
                                                <a 
                                                    href={`https://app.workguru.io/App/PurchaseOrders/Details/${item.poWorkguruId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="opacity-20 group-hover/po:opacity-100 transition-opacity p-0.5 hover:bg-slate-100 rounded"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink className="h-2.5 w-2.5 text-slate-400 hover:text-brand" />
                                                </a>
                                            </div>
                                            <span className="text-[9px] text-slate-300 font-medium uppercase tracking-tight">
                                                WG: {item.workguruStatus}
                                            </span>
                                        </div>
                                        {item.hydrationStatus !== 'HYDRATED' && (
                                            <Tooltip content="Waiting for PO details - Detailed lines are still being downloaded."><AlertCircle className="h-3 w-3 text-amber-500" /></Tooltip>
                                        )}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-sm font-semibold text-slate-900 tabular-nums">
                                            {item.receivedQuantity}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium tabular-nums">
                                            / {item.quantity}
                                        </span>
                                    </div>
                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className={cn(
                                                "h-full transition-all duration-700",
                                                item.receivedQuantity >= item.quantity ? "bg-emerald-500" : "bg-brand"
                                            )}
                                            style={{ width: `${(item.receivedQuantity / item.quantity) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                                <div className="flex flex-col items-end gap-0.5">
                                    <div className={cn(
                                        "text-sm font-semibold whitespace-nowrap",
                                        item.action.type === 'ACTION_FOLLOW_UP' ? "text-orange-600" : 
                                        item.action.type === 'ACTION_ESCALATE' ? "text-red-600" : "text-slate-700"
                                    )}>
                                        {formatProcurementDate(item.expectedDate)}
                                    </div>
                                    <div className="text-[10px] font-medium text-slate-400 lowercase tracking-tight whitespace-nowrap">
                                        {item.daysOutstanding > 0 ? `${item.daysOutstanding}d overdue` : 'on schedule'}
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    </div>
  );
}
