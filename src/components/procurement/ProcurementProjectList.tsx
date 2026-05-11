"use client";

import { ProcurementDashboardItem } from "@/app/actions/procurement";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { RiskBadge } from "./RiskBadge";
import { formatProcurementDate } from "@/lib/procurement-logic";
import { Package2, ArrowRight, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ProcurementProjectListProps {
  items: ProcurementDashboardItem[];
  isLoading?: boolean;
  onSort?: (key: string) => void;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
}

export function ProcurementProjectList({ 
    items, 
    isLoading,
    onSort,
    sortKey,
    sortOrder
}: ProcurementProjectListProps) {
  if (isLoading) {
    return <div className="h-64 flex items-center justify-center text-slate-400 font-medium">Loading project health...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-100 rounded-xl">
        <Package2 className="h-8 w-8 opacity-20" />
        <span className="font-medium tracking-tight">No projects currently tracked.</span>
      </div>
    );
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
            <TableHead 
                className="w-[280px] text-[10px] font-bold uppercase tracking-widest text-slate-500 py-5 pl-8 cursor-pointer group whitespace-nowrap"
                onClick={() => onSort?.('action')}
            >
                <div className="flex items-center">
                    Operational Status
                    <SortIcon k="action" />
                </div>
            </TableHead>
            <TableHead 
                className="text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer group whitespace-nowrap"
                onClick={() => onSort?.('projectNumber')}
            >
                <div className="flex items-center">
                    Project Detail
                    <SortIcon k="projectNumber" />
                </div>
            </TableHead>
            <TableHead 
                className="w-[180px] text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer group whitespace-nowrap"
                onClick={() => onSort?.('progress')}
            >
                <div className="flex items-center">
                    Received vs Ordered
                    <SortIcon k="progress" />
                </div>
            </TableHead>
            <TableHead className="w-[200px] text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Waiting on Materials</TableHead>
            <TableHead 
                className="w-[160px] text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer group whitespace-nowrap"
                onClick={() => onSort?.('outstandingValue')}
            >
                <div className="flex items-center justify-end">
                    Outstanding Cost
                    <SortIcon k="outstandingValue" />
                </div>
            </TableHead>
            <TableHead 
                className="w-[160px] text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer group whitespace-nowrap"
                onClick={() => onSort?.('deliveryDate')}
            >
                <div className="flex items-center justify-end">
                    Delivery Target
                    <SortIcon k="deliveryDate" />
                </div>
            </TableHead>
            <TableHead className="w-[80px] pr-8"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="group hover:bg-slate-50/50 transition-colors border-slate-100">
              <TableCell className="py-6 pl-8">
                <RiskBadge action={item.action} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-slate-900 group-hover:text-brand transition-colors">
                    {item.projectNumber}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium truncate max-w-[250px]">
                    {item.projectName}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-2 pr-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight tabular-nums">
                        {item.stats.totalReceived} / {item.stats.totalOrdered}
                    </span>
                    <span className="text-[10px] font-bold text-brand tabular-nums">
                        {Math.round((item.stats.totalReceived / item.stats.totalOrdered) * 100) || 0}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                    <div 
                        className={cn(
                            "h-full transition-all duration-1000",
                            item.action.severity === 1 ? "bg-red-500" : "bg-brand"
                        )}
                        style={{ width: `${(item.stats.totalReceived / item.stats.totalOrdered) * 100 || 0}%` }}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-8">
                  <div className={cn("flex flex-col", item.stats.delayedLines > 0 ? "text-orange-600" : "text-slate-300")}>
                    <span className="text-base font-semibold leading-none tabular-nums">{item.stats.delayedLines}</span>
                    <span className="text-[9px] uppercase font-bold tracking-tight">Late Deliveries</span>
                  </div>
                  <div className={cn("flex flex-col", item.stats.missingEtaLines > 0 ? "text-purple-600" : "text-slate-300")}>
                    <span className="text-base font-semibold leading-none tabular-nums">{item.stats.missingEtaLines}</span>
                    <span className="text-[9px] uppercase font-bold tracking-tight">Missing ETAs</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span className="text-sm font-semibold text-slate-900 tabular-nums">
                    ${item.stats.outstandingValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold text-slate-700">
                    {formatProcurementDate(item.deliveryDate)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right pr-8">
                <Link href={`/procurement/projects/${item.id}`}>
                    <button className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all group/btn border border-transparent hover:border-slate-100">
                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover/btn:text-brand" />
                    </button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
