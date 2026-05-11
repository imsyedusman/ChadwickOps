"use client";

import { formatProcurementDate } from "@/lib/procurement-logic";
import { 
    Truck, 
    Calendar, 
    AlertCircle, 
    ExternalLink,
    ChevronDown,
    ChevronUp,
    ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { RiskBadge } from "./RiskBadge";

interface ProjectProcurementDetailProps {
  project: {
    id: number;
    projectNumber: string;
    name: string;
    deliveryDate: Date | null;
    url: string;
  };
  purchaseOrders: any[];
}

export function ProjectProcurementDetail({ project, purchaseOrders }: ProjectProcurementDetailProps) {
  // DEFAULTS TO CLOSED (Empty Set)
  const [expandedPos, setExpandedPos] = useState<Set<number>>(new Set());

  const togglePo = (id: number) => {
    const next = new Set(expandedPos);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedPos(next);
  };

  // Identify top project-level blockers
  const blockers = purchaseOrders.flatMap(po => po.lines.filter((l: any) => l.action.severity === 1));

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto w-full px-4 md:px-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Project Header */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{project.projectNumber}</span>
                <a href={project.url} target="_blank" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-brand transition-colors" title="View in WorkGuru">
                    <ExternalLink className="h-3.5 w-3.5" />
                </a>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{project.name}</h1>
          </div>
          
          <div className="flex items-center gap-10">
            <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Delivery Target</span>
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span className="text-base font-semibold text-slate-700">
                        {formatProcurementDate(project.deliveryDate)}
                    </span>
                </div>
            </div>
          </div>
        </div>

        {/* Actionable Blockers Summary */}
        {blockers.length > 0 && (
            <div className="mb-10 p-6 bg-red-50/30 border border-red-100 rounded-2xl">
                <div className="flex items-center gap-2 mb-6">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-red-600">Active Material Blockers ({blockers.length})</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {blockers.slice(0, 8).map((b, i) => (
                        <div key={i} className="flex flex-col gap-2 bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-800 truncate" title={b.name}>{b.name}</span>
                                <span className="text-[10px] font-bold text-red-500 uppercase tracking-tight">Delivery Conflict</span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-[11px] font-medium text-slate-400 italic leading-tight pr-4">ETA exceeds project target</span>
                                <span className="text-[11px] font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded tabular-nums">Qty: {b.quantity - b.receivedQuantity}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* PO List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Linked Purchase Orders ({purchaseOrders.length})</h2>
          </div>
          
          {purchaseOrders.map((po) => {
            const isExpanded = expandedPos.has(po.id);
            const totalItems = po.lines.length;
            const receivedItems = po.lines.filter((l: any) => l.receivedQuantity >= l.quantity).length;
            const isFullyReceived = receivedItems === totalItems && totalItems > 0;

            return (
              <div key={po.id} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:border-slate-300 transition-colors">
                {/* PO Header */}
                <div 
                    className={cn(
                        "flex items-center justify-between p-5 cursor-pointer transition-colors",
                        isExpanded ? "bg-slate-50 border-b border-slate-200" : "bg-white hover:bg-slate-50"
                    )}
                    onClick={() => togglePo(po.id)}
                >
                  <div className="flex items-center gap-6">
                    <div className={cn(
                        "p-3 rounded-xl",
                        isFullyReceived ? "bg-emerald-50 text-emerald-600" : 
                        po.action.severity === 1 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
                    )}>
                        <Truck className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PO: {po.workguruId}</span>
                        <span className="text-base font-semibold text-slate-900 dark:text-slate-100">{po.supplierName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-16">
                    <div className="hidden lg:flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Receipt Progress</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-semibold tabular-nums text-slate-800">{receivedItems}</span>
                            <span className="text-[11px] font-medium text-slate-400">/ {totalItems} items</span>
                        </div>
                    </div>

                    <div className="hidden lg:flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Expected ETA</span>
                        <span className={cn(
                            "text-base font-semibold",
                            !po.expectedDate ? "text-purple-600" : "text-slate-700"
                        )}>
                            {formatProcurementDate(po.expectedDate)}
                        </span>
                    </div>

                    <RiskBadge action={po.action} showAction={false} showReason={false} />

                    {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-300" /> : <ChevronDown className="h-5 w-5 text-slate-300" />}
                  </div>
                </div>

                {/* PO Lines */}
                {isExpanded && (
                  <div className="bg-white dark:bg-slate-950">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                            <tr className="bg-slate-50/30 dark:bg-slate-900/10 border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Material Name & Description</th>
                                <th className="w-[180px] px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center whitespace-nowrap">Rec vs Ord</th>
                                <th className="w-[180px] px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right whitespace-nowrap">Outstanding Cost</th>
                                <th className="w-[280px] px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right whitespace-nowrap">Operational Status & Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {po.lines.map((line: any) => (
                                <tr key={line.workguruId} className="group hover:bg-slate-50/50 transition-colors h-24">
                                    <td className="px-8 py-4">
                                        <div className="flex flex-col gap-1 pr-12">
                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-300 leading-tight" title={line.name}>
                                                {line.name}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                WG_ID: {line.workguruId}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="flex items-baseline gap-1.5">
                                                <span className={cn(
                                                    "text-sm font-semibold tabular-nums",
                                                    line.receivedQuantity >= line.quantity ? "text-emerald-500" : "text-slate-900"
                                                )}>{line.receivedQuantity}</span>
                                                <span className="text-[11px] font-medium text-slate-400">/ {line.quantity}</span>
                                            </div>
                                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-brand" 
                                                    style={{ width: `${(line.receivedQuantity / line.quantity) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                                ${line.outstandingValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </span>
                                            <span className="text-[10px] text-slate-400 uppercase tracking-tight font-medium">
                                                {line.quantity - line.receivedQuantity} outstanding
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <div className="flex justify-end">
                                            <RiskBadge action={line.action} className="items-end" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          {purchaseOrders.length === 0 && (
            <div className="p-20 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-400">No purchase orders linked to this project.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
