"use client";

import React, { useState } from "react";
import { 
  EmployeePeriodAvailability, 
  WorkshopTeam 
} from "@/lib/risk-v2/workforce";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Zap, 
  Building,
  Info
} from "lucide-react";

interface AvailabilityCalendarTabProps {
  employeeAvailabilities: EmployeePeriodAvailability[];
  teams: WorkshopTeam[];
}

export function AvailabilityCalendarTab({ 
  employeeAvailabilities, 
  teams 
}: AvailabilityCalendarTabProps) {
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all");

  // Get distinct dates across the period
  const sampleDays = employeeAvailabilities[0]?.days || [];
  // Show 14 days at a time for optimal readable density
  const [pageOffset, setPageOffset] = useState<number>(0);
  const visibleDays = sampleDays.slice(pageOffset, pageOffset + 14);

  const filteredAvailabilities = employeeAvailabilities.filter(ea => {
    if (selectedTeamFilter === "all") return true;
    if (selectedTeamFilter === "unassigned") return !ea.employee.teamId;
    return ea.employee.teamId === selectedTeamFilter;
  });

  return (
    <div className="space-y-4">
      {/* Calendar Controls & Legend */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
        {/* Team Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Filter Team:</span>
          <select
            value={selectedTeamFilter}
            onChange={e => setSelectedTeamFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
          >
            <option value="all">All Workshop Staff ({employeeAvailabilities.length})</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
            <option value="unassigned">Unassigned Pool</option>
          </select>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-200/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Standard (10h/8h)
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium border border-amber-200/50">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Approved Leave
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 font-medium border border-yellow-200/50">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Pending Leave (Risk)
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-medium border border-purple-200/50">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span> Overtime Shift
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span> Public Holiday / Closed
          </div>
        </div>

        {/* Date Paging */}
        <div className="flex items-center gap-1 self-end md:self-auto">
          <button
            onClick={() => setPageOffset(prev => Math.max(0, prev - 7))}
            disabled={pageOffset === 0}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold px-2">
            Days {pageOffset + 1}–{Math.min(sampleDays.length, pageOffset + 14)} of {sampleDays.length}
          </span>
          <button
            onClick={() => setPageOffset(prev => Math.min(sampleDays.length - 14, prev + 7))}
            disabled={pageOffset + 14 >= sampleDays.length}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Matrix Table */}
      <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold">
                <th className="py-3 px-4 min-w-[180px] sticky left-0 bg-slate-50 dark:bg-slate-850 z-10 border-r border-slate-200 dark:border-slate-800">
                  Workshop Employee
                </th>
                <th className="py-3 px-3 text-center min-w-[70px] border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                  Net Avail
                </th>
                {visibleDays.map(day => {
                  const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6 || day.dayOfWeek === 5;
                  const dayAbbr = day.dayName.slice(0, 3);
                  const dateShort = day.date.slice(5);

                  return (
                    <th 
                      key={day.date} 
                      className={`py-2 px-1 text-center min-w-[50px] border-r border-slate-200/60 dark:border-slate-800/60 ${
                        isWeekend ? 'bg-slate-100/60 dark:bg-slate-800/40 text-slate-400' : ''
                      }`}
                    >
                      <div className="text-[10px] font-bold text-slate-500 uppercase">{dayAbbr}</div>
                      <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{dateShort}</div>
                      {day.isPublicHoliday && (
                        <div className="text-[8px] text-amber-600 font-bold truncate max-w-[45px] mx-auto">PH</div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filteredAvailabilities.map(ea => {
                const emp = ea.employee;
                const empVisibleDays = ea.days.slice(pageOffset, pageOffset + 14);

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    {/* Employee Info Header */}
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{emp.fullName}</span>
                        {emp.teamRole === 'leader' && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                            Lead
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {emp.teamId === 'team-alex' ? "Alex's Team" : emp.teamId === 'team-loc' ? "Loc's Team" : "Unassigned"}
                        {emp.isTemporaryLoan && " (Loaned)"}
                      </div>
                    </td>

                    {/* Net Available Hours in Window */}
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400 border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-850/20">
                      {ea.netAvailableHours}h
                    </td>

                    {/* Day Cells */}
                    {empVisibleDays.map(d => {
                      let cellClass = "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300";
                      let badge = "";

                      if (d.status === 'holiday') {
                        cellClass = "bg-slate-100 dark:bg-slate-800 text-slate-400";
                        badge = "PH";
                      } else if (d.status === 'on_leave') {
                        cellClass = "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold";
                        badge = "LEAVE";
                      } else if (d.status === 'partial_leave') {
                        cellClass = "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-semibold";
                        badge = `${d.netAvailableHours}h`;
                      } else if (d.status === 'pending_leave') {
                        cellClass = "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border border-yellow-300/50";
                        badge = `${d.netAvailableHours}h?`;
                      } else if (d.status === 'overtime') {
                        cellClass = "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-bold";
                        badge = `+${d.approvedOvertimeHours || d.proposedOvertimeHours}h`;
                      } else if (d.status === 'off') {
                        cellClass = "bg-slate-50/50 dark:bg-slate-800/20 text-slate-300 dark:text-slate-600";
                        badge = "—";
                      } else {
                        // Standard available shift
                        badge = `${d.standardShiftHours}h`;
                        cellClass = "text-slate-800 dark:text-slate-200 font-medium";
                      }

                      return (
                        <td 
                          key={d.date}
                          className={`p-1 text-center border-r border-slate-200/50 dark:border-slate-800/50 text-[11px] ${cellClass}`}
                          title={`${emp.fullName} on ${d.date}: ${d.status} (${d.netAvailableHours}h available)`}
                        >
                          <span className="font-mono text-[11px] inline-block">{badge}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Privacy Note */}
      <div className="flex items-center gap-2 text-xs text-slate-500 p-2">
        <Info className="w-3.5 h-3.5 text-slate-400" />
        <span>Workforce calendar displays availability and operational shift hours only. Sensitive medical information is never stored or shown.</span>
      </div>
    </div>
  );
}
