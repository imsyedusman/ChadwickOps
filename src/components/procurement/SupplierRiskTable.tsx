"use client";

import { SupplierRiskItem } from "@/app/actions/procurement";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { AlertCircle, Clock, Info, ArrowRight, ChevronDown, ChevronRight, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SupplierRiskTableProps {
  items: SupplierRiskItem[];
  isLoading?: boolean;
  onSupplierClick?: (name: string) => void;
  onSort?: (key: string) => void;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
}

export function SupplierRiskTable({ 
    items, 
    isLoading, 
    onSupplierClick,
    onSort,
    sortKey,
    sortOrder
}: SupplierRiskTableProps) {
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  if (isLoading) {
    return <div className="h-64 flex items-center justify-center text-slate-400 font-medium">Loading suppliers...</div>;
  }

  const SortIcon = ({ k }: { k: string }) => {
    if (sortKey !== k) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />;
    return <ArrowUpDown className={cn("ml-2 h-3 w-3 text-brand", sortOrder === 'desc' ? "rotate-180" : "")} />;
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm w-full">
      <Table className="w-full">
        <TableHeader className="bg-slate-50/50">
          <TableRow className="hover:bg-transparent border-slate-200">
            <TableHead className="w-[60px] pl-8"></TableHead>
            <TableHead 
                className="text-[10px] font-bold uppercase tracking-widest text-slate-500 py-5 cursor-pointer group whitespace-nowrap"
                onClick={() => onSort?.('supplierName')}
            >
                <div className="flex items-center">
                    Supplier Name
                    <SortIcon k="supplierName" />
                </div>
            </TableHead>
            <TableHead className="w-[200px] text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer group whitespace-nowrap"
                onClick={() => onSort?.('affectedProjectCount')}
            >
                <div className="flex items-center">
                    Projects Waiting
                    <SortIcon k="affectedProjectCount" />
                </div>
            </TableHead>
            <TableHead className="w-[300px] text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Material Issues</TableHead>
            <TableHead className="w-[100px] pr-8"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <>
                <TableRow 
                    key={item.supplierName} 
                    className={cn(
                        "group transition-colors border-slate-100 cursor-pointer h-20 hover:bg-slate-50/50",
                        expandedSupplier === item.supplierName ? "bg-slate-50" : ""
                    )}
                    onClick={() => setExpandedSupplier(expandedSupplier === item.supplierName ? null : item.supplierName)}
                >
                    <TableCell className="pl-8">
                        {expandedSupplier === item.supplierName ? (
                            <ChevronDown className="h-4 w-4 text-brand" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-slate-300" />
                        )}
                    </TableCell>
                    <TableCell>
                        <span className="text-sm font-semibold text-slate-900 group-hover:text-brand transition-colors whitespace-nowrap">
                            {item.supplierName}
                        </span>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="text-sm font-semibold text-slate-700 tabular-nums">
                                {item.affectedProjectCount}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                Projects
                            </span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-8 whitespace-nowrap">
                            <div className={cn("flex items-center gap-2", item.deliveryRiskCount > 0 ? "text-red-600" : "text-slate-300")}>
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-[11px] font-bold uppercase tracking-tight">{item.deliveryRiskCount} Risks</span>
                            </div>
                            <div className={cn("flex items-center gap-2", item.delayedLineCount > 0 ? "text-orange-600" : "text-slate-300")}>
                                <Clock className="h-4 w-4" />
                                <span className="text-[11px] font-bold uppercase tracking-tight">{item.delayedLineCount} Late</span>
                            </div>
                            <div className={cn("flex items-center gap-2", item.missingEtaCount > 0 ? "text-purple-600" : "text-slate-300")}>
                                <Info className="h-4 w-4" />
                                <span className="text-[11px] font-bold uppercase tracking-tight">{item.missingEtaCount} No ETA</span>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                        <button 
                            className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all group/btn border border-transparent hover:border-slate-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSupplierClick?.(item.supplierName);
                            }}
                        >
                            <ArrowRight className="h-4 w-4 text-slate-300 group-hover/btn:text-brand" />
                        </button>
                    </TableCell>
                </TableRow>
                
                {/* Expanded Traceability View - DEFAULTS TO CLOSED (state-managed) */}
                {expandedSupplier === item.supplierName && (
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-t-0">
                        <TableCell colSpan={6} className="p-0">
                            <div className="px-20 py-8 space-y-6">
                                <div className="flex flex-col gap-1">
                                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">Supplier Impact Trace</h4>
                                    <p className="text-sm font-medium text-slate-600">
                                        This supplier is currently impacting {item.affectedProjectCount} project(s) with {item.totalLineCount} outstanding items.
                                    </p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-12 pb-6">
                                    <div className="space-y-4">
                                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Operational Bottleneck Analysis</h5>
                                        <div className="p-5 bg-white rounded-xl border border-slate-100 shadow-sm flex items-start gap-4">
                                            <div className="p-2 bg-slate-50 rounded-lg">
                                                <ArrowRight className="h-4 w-4 text-brand" />
                                            </div>
                                            <div className="flex flex-col gap-1 pt-1">
                                                <p className="text-sm font-semibold text-slate-800 leading-snug">
                                                    {item.deliveryRiskCount > 0 ? "Production delivery risk detected." : 
                                                     item.delayedLineCount > 0 ? "Supplier delivery is overdue." : 
                                                     "Missing delivery confirmation."}
                                                </p>
                                                <p className="text-[12px] font-medium text-slate-500 italic">
                                                    {item.deliveryRiskCount > 0 ? "Materials are expected after the project delivery target." : 
                                                     item.delayedLineCount > 0 ? "The expected delivery date has passed without receipt." : 
                                                     "Supplier has not provided an ETA for these backorders."}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <button 
                                            className="px-8 py-4 bg-slate-900 text-white font-bold text-[11px] uppercase tracking-widest rounded-xl hover:bg-brand transition-all shadow-lg"
                                            onClick={() => onSupplierClick?.(item.supplierName)}
                                        >
                                            Investigate Supplier Backorders
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </TableCell>
                    </TableRow>
                )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
