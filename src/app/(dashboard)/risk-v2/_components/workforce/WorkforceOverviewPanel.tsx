"use client";

import React, { useState } from "react";
import { WorkforceDashboardData } from "@/lib/risk-v2/workforce";
import { TeamRosterTab } from "./TeamRosterTab";
import { AvailabilityCalendarTab } from "./AvailabilityCalendarTab";
import { LeaveAdminTab } from "./LeaveAdminTab";
import { OvertimePlannerTab } from "./OvertimePlannerTab";
import { SkillsCoverageTab } from "./SkillsCoverageTab";
import { 
  Users, 
  Calendar as CalendarIcon, 
  FileText, 
  Zap, 
  Award, 
  AlertTriangle, 
  ShieldCheck, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  Layers,
  ArrowRight
} from "lucide-react";

interface WorkforceOverviewPanelProps {
  data: WorkforceDashboardData;
  onRefresh?: () => void;
}

type WorkforceSubTab = 'teams' | 'calendar' | 'leave' | 'overtime' | 'skills';

export function WorkforceOverviewPanel({ data, onRefresh }: WorkforceOverviewPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<WorkforceSubTab>('teams');

  const alexTeam = data.teamSummaries.find(t => t.teamId === 'team-alex');
  const locTeam = data.teamSummaries.find(t => t.teamId === 'team-loc');

  const pendingLeaveRequestsCount = data.leaveRequests.filter(l => l.status === 'pending').length;
  const proposedOvertimeCount = data.overtimeShifts.filter(s => s.status === 'proposed').length;

  return (
    <div className="space-y-6">
      {/* Top Headline Capacity & Roster KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Roster vs Manual 22 Headcount */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Roster vs Baseline</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {data.actualActiveRosterCount} <span className="text-sm font-semibold text-slate-400">/ {data.manualHeadcountTarget}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {data.rosterNetAvailableHours}h roster vs {data.manualHeadcountCapacityHours}h target
          </div>
        </div>

        {/* Alex's Team */}
        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-400">
            <span>Alex's Team</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {alexTeam?.netAvailableHours || 0}h
          </div>
          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
            {alexTeam?.memberCount || 0} active workers • Lead: Alex Alvarado
          </div>
        </div>

        {/* Loc's Team */}
        <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-950/60 bg-blue-50/20 dark:bg-blue-950/10 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-800 dark:text-blue-400">
            <span>Loc's Team</span>
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {locTeam?.netAvailableHours || 0}h
          </div>
          <div className="text-[10px] text-blue-700 dark:text-blue-400 mt-1 font-medium">
            {locTeam?.memberCount || 0} active workers • Lead: Loc Lu
          </div>
        </div>

        {/* Leave Impact & Risk */}
        <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-950/60 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Leave Impact</span>
            <FileText className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            -{data.rosterApprovedLeaveImpactHours}h
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <span>Approved leave</span>
            {data.rosterPendingLeaveRiskHours > 0 && (
              <span className="font-bold text-yellow-600 dark:text-yellow-400">
                (+{data.rosterPendingLeaveRiskHours}h pending risk)
              </span>
            )}
          </div>
        </div>

        {/* Planned Overtime */}
        <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-950/60 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Planned Overtime</span>
            <Zap className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
            +{data.rosterApprovedOvertimeHours}h
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Approved ({data.rosterProposedOvertimeHours}h proposed extra)
          </div>
        </div>
      </div>

      {/* Upcoming Shortages Alert if any */}
      {data.upcomingShortages.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-300 space-y-1">
            <div className="font-bold">
              Upcoming Staffing Alerts ({data.upcomingShortages.length} day(s) below target headcount):
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {data.upcomingShortages.slice(0, 4).map(s => (
                <div key={s.date} className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-amber-200/60 dark:border-amber-800/40 text-[11px]">
                  <strong>{s.date} ({s.dayName})</strong>: {s.availableHeadcount} active workers ({s.reasons.join(', ')})
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Workforce Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 self-start overflow-x-auto max-w-full">
        <button
          onClick={() => setActiveSubTab('teams')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'teams'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-blue-500" />
          <span>Workshop Teams ({data.teams.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('calendar')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'calendar'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5 text-emerald-500" />
          <span>Availability Calendar</span>
        </button>

        <button
          onClick={() => setActiveSubTab('leave')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'leave'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-amber-500" />
          <span>Leave Intake & Review</span>
          {pendingLeaveRequestsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
              {pendingLeaveRequestsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('overtime')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'overtime'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-purple-500" />
          <span>Overtime Planning</span>
          {proposedOvertimeCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-500 text-white">
              {proposedOvertimeCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('skills')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'skills'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-indigo-500" />
          <span>Skills Matrix & Stage Bench</span>
        </button>
      </div>

      {/* Subtab Contents */}
      {activeSubTab === 'teams' && (
        <TeamRosterTab 
          teams={data.teams} 
          employees={data.employees} 
          onRefresh={onRefresh} 
        />
      )}

      {activeSubTab === 'calendar' && (
        <AvailabilityCalendarTab 
          employeeAvailabilities={data.employeeAvailabilities} 
          teams={data.teams} 
        />
      )}

      {activeSubTab === 'leave' && (
        <LeaveAdminTab 
          leaveRequests={data.leaveRequests} 
          employees={data.employees} 
          onRefresh={onRefresh} 
        />
      )}

      {activeSubTab === 'overtime' && (
        <OvertimePlannerTab 
          overtimeShifts={data.overtimeShifts} 
          employees={data.employees} 
          onRefresh={onRefresh} 
        />
      )}

      {activeSubTab === 'skills' && (
        <SkillsCoverageTab 
          stageSkillCoverage={data.stageSkillCoverage} 
          totalActiveStaffCount={data.actualActiveRosterCount}
          totalNetAvailableHours={data.rosterNetAvailableHours}
        />
      )}
    </div>
  );
}
