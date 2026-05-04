"use client";

import React, { useState, useMemo } from "react";
import { 
  Search, 
  ArrowUpDown, 
  RefreshCw,
  ExternalLink,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { MonthPicker } from "@/components/reports/MonthPicker";
import { parse, format } from "date-fns";
import { syncProjectFinancials } from "@/app/actions/financials";

interface Financials {
    totalCostToDate: number;
    totalInvoicedToDate: number;
    unrecoveredAmount: number;
    labourCostThisMonth: number;
    materialCostThisMonth: number;
    updatedAt: Date | string | null;
}

interface Project {
    id: number;
    workguruId: string;
    projectNumber: string;
    name: string;
    projectManager: string | null;
    clientName: string | null;
    financials: Financials | null;
}

interface JobCostTableProps {
    initialData: Project[];
    currentMonth: string;
}

export function JobCostTable({ initialData, currentMonth }: JobCostTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [isSyncing, setIsSyncing] = useState<number | null>(null);
    const [hideNoActivity, setHideNoActivity] = useState(false);

    const monthDate = useMemo(() => parse(currentMonth, 'yyyy-MM', new Date()), [currentMonth]);

    const handleMonthChange = (date: Date) => {
        const monthStr = format(date, 'yyyy-MM');
        router.push(`/reports/job-cost?month=${monthStr}`);
    };

    const handleSync = async (projectId: number) => {
        setIsSyncing(projectId);
        try {
            await syncProjectFinancials(projectId);
            router.refresh();
        } finally {
            setIsSyncing(null);
        }
    };

    const filteredData = useMemo(() => {
        if (!initialData) return [];
        return initialData.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.projectNumber.toLowerCase().includes(search.toLowerCase()) ||
                p.clientName?.toLowerCase().includes(search.toLowerCase());
            
            if (!matchesSearch) return false;

            if (hideNoActivity) {
                const hasActivity = (p.financials?.totalCostToDate || 0) > 0 || (p.financials?.totalInvoicedToDate || 0) > 0;
                return hasActivity;
            }

            return true;
        });
    }, [initialData, search, hideNoActivity]);

    const formatCurrency = (val: number | undefined | null) => {
        const amount = val || 0;
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(amount);
    };

    return (
        <div className="space-y-4">
            {/* Filters & Month Picker */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search projects, clients, IDs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all shadow-sm"
                        />
                    </div>

                    <label className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl cursor-pointer hover:border-brand/30 transition-all shadow-sm shrink-0">
                        <input 
                            type="checkbox" 
                            checked={hideNoActivity}
                            onChange={(e) => setHideNoActivity(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/20"
                        />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Hide No Activity</span>
                    </label>
                </div>

                <div className="flex items-center gap-4">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
                      {filteredData.length} projects shown
                   </p>
                   <MonthPicker currentDate={monthDate} onChange={handleMonthChange} />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm">
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">Project / Client</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Labour</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Materials</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Total Cost</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Invoiced</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Unrecovered</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Status</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Recalc</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {filteredData.map((project) => {
                                const f = project.financials;
                                const cost = f?.totalCostToDate || 0;
                                const invoiced = f?.totalInvoicedToDate || 0;
                                const unrecovered = f?.unrecoveredAmount || 0;
                                
                                // Health Logic
                                let status = { label: "Fully Covered", color: "emerald" };
                                if (cost > 0 && invoiced === 0) {
                                    status = { label: "Unbilled", color: "red" };
                                } else if (cost > invoiced) {
                                    status = { label: "Partially Recovered", color: "amber" };
                                } else if (cost === 0 && invoiced === 0) {
                                    status = { label: "No Activity", color: "slate" };
                                }

                                return (
                                    <tr key={project.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-brand bg-brand/5 px-2 py-0.5 rounded-md tabular-nums uppercase">{project.projectNumber}</span>
                                                    <a 
                                                        href={`https://app.workguru.io/App/Projects/Detail2/${project.workguruId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm font-bold text-slate-900 dark:text-white hover:text-brand transition-colors flex items-center gap-1.5"
                                                    >
                                                        {project.name}
                                                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </a>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">{project.clientName}</span>
                                                    {project.projectManager && (
                                                        <>
                                                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                            <span className="text-[11px] text-slate-400 font-medium tracking-tight">PM: {project.projectManager}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-6 text-right">
                                            <span className="text-[13px] font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                                                {formatCurrency(f?.labourCostThisMonth)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-6 text-right">
                                            <span className="text-[13px] font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                                                {formatCurrency(f?.materialCostThisMonth)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-6 text-right">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                                                {formatCurrency(cost)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-6 text-right">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                                                {formatCurrency(invoiced)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-6 text-right">
                                            <span className={cn(
                                                "text-sm font-black tabular-nums",
                                                unrecovered > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                                            )}>
                                                {formatCurrency(unrecovered)}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className={cn(
                                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider",
                                                status.color === "red" && "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400",
                                                status.color === "amber" && "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-900/20 text-amber-600 dark:text-amber-400",
                                                status.color === "emerald" && "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-900/20 text-emerald-600 dark:text-emerald-400",
                                                status.color === "slate" && "bg-slate-50 dark:bg-slate-500/10 border-slate-100 dark:border-slate-900/20 text-slate-500 dark:text-slate-400"
                                            )}>
                                                <span>{status.label}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <button 
                                                    onClick={() => handleSync(project.id)}
                                                    disabled={isSyncing === project.id}
                                                    className={cn(
                                                        "p-2 rounded-xl border transition-all flex items-center gap-2",
                                                        isSyncing === project.id 
                                                            ? "bg-slate-50 dark:bg-slate-800 text-slate-300"
                                                            : "bg-white dark:bg-slate-900 text-slate-400 hover:text-brand hover:border-brand/30 shadow-sm"
                                                    )}
                                                >
                                                    <span className="text-[9px] font-bold uppercase tracking-wider pl-1">{isSyncing === project.id ? "Syncing..." : "Recalc"}</span>
                                                    <RefreshCw className={cn("h-3.5 w-3.5", isSyncing === project.id && "animate-spin")} />
                                                </button>
                                                {f?.updatedAt && (
                                                    <span className="text-[8px] text-slate-400 font-medium tabular-nums">
                                                        Last: {new Date(f.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-between px-8 py-4 bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm rounded-3xl border border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-slate-400" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Data from snapshots. {initialData?.length || 0} projects shown.
                    </p>
                </div>
            </div>
        </div>
    );
}
