'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Download, 
  FileText, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { getInvoicedThisMonthReport } from '@/app/actions/financials';
import { cn } from '@/lib/utils';

import { InvoiceSyncButton } from './InvoiceSyncButton';

interface InvoiceData {
  projectNumber: string;
  projectName: string;
  clientName: string | null;
  invoiceDate: Date | string | null;
  invoiceAmount: string | number | null;
  invoiceStatus: string | null;
  invoiceNumber: string | null;
  invoiceWorkguruId: string | null;
}

interface SummaryData {
  totalAmount: number;
  totalCount: number;
  previousMonthAmount: number;
}

export function InvoicedThisMonthSection({ lastSyncedText }: { lastSyncedText: string }) {
  const [currentMonth, setCurrentMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [data, setData] = useState<InvoiceData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      setLoading(true);
      try {
        const result = await getInvoicedThisMonthReport(currentMonth);
        if (isMounted) {
          setData(result.invoices as any);
          setSummary(result.summary);
        }
      } catch (error) {
        console.error('Failed to fetch invoiced report:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => { isMounted = false; };
  }, [currentMonth, refreshKey]);

  const handlePrevMonth = () => {
    setCurrentMonth(prev => format(subMonths(parseISO(prev + '-01'), 1), 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => format(addMonths(parseISO(prev + '-01'), 1), 'yyyy-MM'));
  };

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const lowerSearch = search.toLowerCase();
    return data.filter(inv => 
      inv.projectName?.toLowerCase().includes(lowerSearch) ||
      inv.projectNumber?.toLowerCase().includes(lowerSearch) ||
      inv.clientName?.toLowerCase().includes(lowerSearch)
    );
  }, [data, search]);

  const formatCurrency = (val: number | string | null | undefined) => {
    const amount = Number(val || 0);
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return format(new Date(date), 'dd MMM yyyy');
  };

  const getStatusColor = (status: string | null) => {
    const s = (status || '').toLowerCase();
    if (s === 'paid') return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
    if (s === 'sent') return 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
    if (s === 'approved') return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
    return 'bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/20';
  };

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    
    const headers = ['Project Number', 'Project Name', 'Client', 'Invoice Date', 'Amount', 'Status'];
    const rows = filteredData.map(inv => [
      inv.projectNumber,
      `"${(inv.projectName || '').replace(/"/g, '""')}"`,
      `"${(inv.clientName || '').replace(/"/g, '""')}"`,
      formatDate(inv.invoiceDate),
      Number(inv.invoiceAmount || 0).toFixed(2),
      inv.invoiceStatus || 'Unknown'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invoiced-${format(parseISO(currentMonth + '-01'), 'MMM-yyyy').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate trend
  let trendPercent = 0;
  let isUp = false;
  let diffAmount = 0;
  let diffText = "-";
  
  if (summary && summary.previousMonthAmount > 0) {
    diffAmount = summary.totalAmount - summary.previousMonthAmount;
    trendPercent = Math.round(Math.abs(diffAmount / summary.previousMonthAmount) * 100);
    isUp = diffAmount >= 0;
    diffText = `${isUp ? '+' : '-'}${formatCurrency(Math.abs(diffAmount))}`;
  } else if (summary && summary.totalAmount > 0) {
    diffAmount = summary.totalAmount;
    trendPercent = 100;
    isUp = true;
    diffText = `+${formatCurrency(diffAmount)}`;
  }
  
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
      const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [filteredData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                <Receipt className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em]">Monthly Billing</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Invoiced This Month</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Detailed breakdown of all approved, sent, and paid invoices for the selected month.
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-3">
            <InvoiceSyncButton 
              lastSyncedText={lastSyncedText} 
              onSuccess={() => setRefreshKey(k => k + 1)}
            />
            <div className="flex items-center gap-4 bg-white dark:bg-slate-900 px-2 py-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
              <button 
                onClick={handlePrevMonth}
                className="p-2 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-xl transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="w-32 text-center flex items-center justify-center gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-widest uppercase">
                  {format(parseISO(currentMonth + '-01'), 'MMMM yyyy')}
                </span>
              </div>
              <button 
                onClick={handleNextMonth}
                className="p-2 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-xl transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard 
            title="Total Invoiced" 
            value={loading ? '-' : formatCurrency(summary?.totalAmount)} 
            icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
            description="Total value of all approved invoices"
          />
          <StatCard 
            title="Invoice Count" 
            value={loading ? '-' : (summary?.totalCount || 0).toString()} 
            icon={<FileText className="h-5 w-5 text-blue-500" />}
            description="Number of invoices issued"
          />
          <StatCard 
            title="Vs Last Month" 
            value={loading ? '-' : diffText} 
            valueClass={isUp ? "text-emerald-500" : "text-red-500"}
            icon={isUp ? <TrendingUp className="h-5 w-5 text-indigo-500" /> : <TrendingDown className="h-5 w-5 text-indigo-500" />}
            trend={summary && summary.previousMonthAmount > 0 ? `${trendPercent}%` : undefined}
            trendColor={isUp ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/10" : "text-red-500 border-red-500/20 bg-red-500/10"}
            trendDirection={isUp ? 'up' : 'down'}
            description="Difference in invoiced amount from the previous month"
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search projects or clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={handleExportCSV}
            disabled={filteredData.length === 0 || loading}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-brand animate-spin" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 whitespace-nowrap">Project</th>
                  <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 whitespace-nowrap">Client</th>
                  <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 whitespace-nowrap">Invoice Number</th>
                  <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 whitespace-nowrap">Invoice Date</th>
                  <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 whitespace-nowrap text-right">Amount</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 whitespace-nowrap text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {sortedData.length > 0 ? (
                  sortedData.map((inv, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-black text-brand bg-brand/5 px-2 py-0.5 rounded-md tabular-nums uppercase w-fit">{inv.projectNumber}</span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                            {inv.projectName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-6">
                        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-tight">
                          {inv.clientName || 'No Client'}
                        </span>
                      </td>
                      <td className="px-4 py-6 whitespace-nowrap">
                        {inv.invoiceWorkguruId ? (
                          <a 
                            href={`https://app.workguru.io/App/Invoices/Details/${inv.invoiceWorkguruId}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-xs font-bold text-brand hover:underline flex items-center gap-1 w-fit"
                          >
                            {inv.invoiceNumber || `INV-${inv.invoiceWorkguruId}`}
                            <ArrowUpRight className="h-3 w-3 opacity-50" />
                          </a>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-6 whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {formatDate(inv.invoiceDate)}
                        </span>
                      </td>
                      <td className="px-4 py-6 text-right whitespace-nowrap">
                        <span className="text-[13px] font-black text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(inv.invoiceAmount)}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider",
                          getStatusColor(inv.invoiceStatus)
                        )}>
                          {inv.invoiceStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center">
                      <p className="text-sm text-slate-400 font-medium">No invoices found for this month.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  trend, 
  trendColor, 
  trendDirection,
  description,
  valueClass
}: { 
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendColor?: string;
  trendDirection?: 'up' | 'down';
  description: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm group hover:shadow-md hover:border-brand/20 transition-all duration-300 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 group-hover:text-brand transition-all duration-500 pointer-events-none">
        {icon}
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 group-hover:border-brand/20 transition-colors">
           {icon}
        </div>
        {trend && (
           <div className={cn("flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ring-1 ring-inset transition-all", trendColor)}>
              {trendDirection === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend}
           </div>
        )}
      </div>
      <div className="space-y-1">
        <h3 className={cn("text-3xl font-bold tracking-tight tabular-nums leading-none", valueClass || "text-slate-900 dark:text-white")}>
          {value}
        </h3>
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 tracking-tight">{title}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium pt-1">{description}</p>
      </div>
    </div>
  );
}
