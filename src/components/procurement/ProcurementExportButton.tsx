"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcurementExportButtonProps {
    activeTab: string;
    filters: {
        query: string;
        backorderFilter?: string;
        supplierFilter?: string | null;
        sortKey: string;
        sortOrder: 'asc' | 'desc';
    };
}

export function ProcurementExportButton({ activeTab, filters }: ProcurementExportButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async (format: 'xlsx' | 'csv') => {
        setIsExporting(true);
        setIsOpen(false);

        try {
            const params = new URLSearchParams({
                tab: activeTab,
                format,
                query: filters.query,
                filter: filters.backorderFilter || 'ALL',
                supplier: filters.supplierFilter || '',
                sortKey: filters.sortKey,
                sortOrder: filters.sortOrder
            });

            window.location.href = `/api/procurement/export?${params.toString()}`;
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setTimeout(() => setIsExporting(false), 2000); // Buffer for download start
        }
    };

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2.5 h-12 px-6 bg-slate-900 text-white rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50",
                    isExporting && "animate-pulse"
                )}
                disabled={isExporting}
            >
                <Download className="h-4 w-4" />
                {isExporting ? "Exporting..." : "Export"}
                <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-30" 
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => handleExport('xlsx')}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">Excel (.xlsx)</span>
                                <span className="text-[9px] font-medium text-slate-400">Best for analysis</span>
                            </div>
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-800" />
                        <button 
                            onClick={() => handleExport('csv')}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <FileText className="h-4 w-4 text-blue-600" />
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">CSV (.csv)</span>
                                <span className="text-[9px] font-medium text-slate-400">Plain text data</span>
                            </div>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
