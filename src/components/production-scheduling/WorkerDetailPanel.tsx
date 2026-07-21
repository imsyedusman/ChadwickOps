"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, Loader2, Info, ExternalLink, CalendarDays, Clock, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import { BlurredValue } from "@/components/ui/BlurredValue";
import { getWorkerDetail } from "@/app/actions/production-scheduling";

interface WorkerDetailPanelProps {
  staffId: number | null;
  isOpen: boolean;
  onClose: () => void;
  isFinance?: boolean;
}

const stageNames: Record<string, string> = {
  frameAssembly: "Frame Assembly",
  switchgearMount: "Switchgear Mount",
  busbar: "Busbar",
  wiring: "Wiring",
  labels: "Labels",
  testing: "Testing",
  packagingFreight: "Pack & Freight",
};

export function WorkerDetailPanel({ staffId, isOpen, onClose, isFinance = false }: WorkerDetailPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (isOpen && staffId) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const res = await getWorkerDetail(staffId);
          if (res.success && res.data) {
            setData(res.data);
          } else {
            toast.error(res.error || "Failed to load worker details");
          }
        } catch (error: any) {
          toast.error(error.message || "Failed to load worker details");
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen, staffId]);

  if (!isOpen) return null;

  const staff = data?.staff;
  const assignments = data?.assignments || [];
  const absences = data?.absences || [];
  const breakdown = data?.capacityBreakdown || [];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[110] transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[420px] bg-white dark:bg-slate-900 shadow-2xl z-[111] flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <User className="w-5 h-5 text-brand" />
                {staff?.fullName || "Worker Details"}
              </h2>
              {staff?.isActive === false && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase tracking-widest">
                  Inactive
                </span>
              )}
            </div>
            {staff && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rate</span>
                <span className="text-sm font-mono font-medium text-slate-900 dark:text-slate-100">
                  <BlurredValue 
                    value={`$${parseFloat(staff.hourlyRate).toFixed(2)}/hr`} 
                    isAuthorized={isFinance} 
                  />
                </span>
              </div>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white dark:bg-slate-900">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
              <p className="text-sm font-medium">Loading worker details...</p>
            </div>
          ) : !data ? (
            <div className="text-center text-slate-500 text-sm py-12">No data available.</div>
          ) : (
            <>
              {/* Efficiency Ratings */}
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  Efficiency Ratings
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(stageNames).map(key => {
                    const rating = staff[key];
                    if (rating === null || rating === undefined) return null;
                    const pct = Math.round(parseFloat(rating) * 100);
                    return (
                      <div key={key} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm text-xs">
                        <span className="font-medium text-slate-600 dark:text-slate-300">{stageNames[key]}</span>
                        <span className={cn(
                          "font-bold",
                          pct >= 100 ? "text-emerald-600 dark:text-emerald-400" : pct >= 80 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                        )}>{pct}%</span>
                      </div>
                    );
                  })}
                  {Object.keys(stageNames).every(key => staff[key] === null || staff[key] === undefined) && (
                    <span className="text-xs text-slate-400 italic">No ratings recorded.</span>
                  )}
                </div>
              </section>

              {/* Current Assignments */}
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Current Assignments
                </h3>
                {assignments.length > 0 ? (
                  <div className="space-y-3">
                    {assignments.map((a: any) => (
                      <div key={a.id} className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-start mb-2">
                          <a 
                            href={`https://app.workguru.io/App/Projects/Details?Id=${a.workguruId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-brand hover:underline flex items-center gap-1.5"
                          >
                            {a.projectNumber} <ExternalLink className="w-3 h-3" />
                          </a>
                          <span className="text-[10px] font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                            {parseFloat(a.assignedHours).toFixed(1)} hrs
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 truncate">
                          {a.projectName}
                        </p>
                        <div className="flex justify-between items-center text-[11px] text-slate-500">
                          <span className="uppercase tracking-wider font-medium">
                            {a.stage.replace(/_/g, ' ')}
                          </span>
                          <span>
                            {a.projectedStart && a.projectedEnd 
                              ? `${format(parseISO(a.projectedStart), 'dd MMM')} - ${format(parseISO(a.projectedEnd), 'dd MMM')}` 
                              : '-'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No active assignments.</p>
                )}
              </section>

              {/* Upcoming Absences */}
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" /> Upcoming Absences
                </h3>
                {absences.length > 0 ? (
                  <div className="space-y-2">
                    {absences.map((a: any) => (
                      <div key={a.id} className="flex justify-between items-center bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                        <div>
                          <p className="text-sm font-bold text-red-700 dark:text-red-400">
                            {format(parseISO(a.startDate), 'dd MMM')} - {format(parseISO(a.endDate), 'dd MMM')}
                          </p>
                          {a.reason && (
                            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{a.reason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No upcoming absences recorded.</p>
                )}
              </section>

              {/* 8-Week Availability */}
              <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  8-Week Availability
                  <Tooltip content="Shows this worker's committed vs. free hours over the next 8 weeks. Uses their active assignments to calculate commitments.">
                    <Info className="w-3 h-3 opacity-70" />
                  </Tooltip>
                </h3>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Week</th>
                        <th className="px-3 py-2 text-right">Committed</th>
                        <th className="px-3 py-2 text-right">Free</th>
                        <th className="px-3 py-2 w-1/3">Utilisation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {breakdown.map((w: any, idx: number) => {
                        const total = w.committedHours + w.freeHours;
                        const pct = total > 0 ? (w.committedHours / total) * 100 : 0;
                        return (
                          <tr key={idx} className={cn("hover:bg-slate-50/50 dark:hover:bg-slate-800/30", w.isAbsent ? "opacity-60" : "")}>
                            <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                              {format(parseISO(w.weekStart), 'dd MMM')}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                              {w.committedHours.toFixed(1)}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                              {w.freeHours.toFixed(1)}
                            </td>
                            <td className="px-3 py-2">
                              {w.isAbsent && total === 0 ? (
                                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Leave</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                    <div 
                                      className={cn("h-full", pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500")} 
                                      style={{ width: `${Math.min(100, pct)}%` }} 
                                    />
                                  </div>
                                  <span className={cn(
                                    "text-[10px] font-bold w-9 text-right",
                                    pct >= 100 ? "text-red-600 dark:text-red-400" : pct >= 80 ? "text-amber-600 dark:text-amber-500" : "text-slate-500 dark:text-slate-400"
                                  )}>
                                    {pct.toFixed(0)}%
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

            </>
          )}
        </div>
      </div>
    </>
  );
}
