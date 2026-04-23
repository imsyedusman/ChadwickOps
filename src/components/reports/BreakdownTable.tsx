"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface BreakdownTableProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  data: any[];
  mode: 'pm' | 'client';
  preset: string;
}

export function BreakdownTable({ title, subtitle, icon, data, mode, preset }: BreakdownTableProps) {
  const router = useRouter();

  const handleRowClick = (item: any) => {
    const baseUrl = `/reports/projects?p=${preset}&m=orders_received`;
    const url = mode === 'pm' 
      ? `${baseUrl}&pm=${encodeURIComponent(item.name || 'Unassigned')}`
      : `${baseUrl}&clientId=${item.clientId}`;
    router.push(url);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">{title}</h3>
            <p className="text-[10px] font-medium text-slate-400">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 dark:bg-slate-800/30">
            <tr>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name</th>
              <th className="px-2 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Jobs</th>
              <th className="px-2 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Avg</th>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Total Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {data.map((item, idx) => (
              <tr 
                key={idx} 
                className="group hover:bg-slate-50/30 dark:hover:bg-slate-800/20 transition-colors cursor-pointer" 
                onClick={() => handleRowClick(item)}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-brand transition-colors block line-clamp-1">
                      {item.name || "Unassigned"}
                    </span>
                    <ArrowUpRight className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </td>
                <td className="px-2 py-4 text-center">
                  <span className="text-[11px] font-bold text-slate-900 dark:text-white tabular-nums">
                    {item.projectCount}
                  </span>
                </td>
                <td className="px-2 py-4 text-center">
                  <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                    {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(item.avgValue || 0))}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                    {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(item.totalValue || 0))}
                  </span>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
               <tr>
                 <td colSpan={4} className="px-6 py-12 text-center text-xs text-slate-400 italic">No project data found for this period.</td>
               </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
