"use client";

import React, { useState, useTransition } from "react";
import { 
  WorkshopEmployee, 
  WorkshopTeam 
} from "@/lib/risk-v2/workforce";
import { assignEmployeeToTeamAction, saveWorkshopTeamAction } from "@/actions/workforce-v2";
import { 
  Users, 
  UserCheck, 
  ArrowRightLeft, 
  Plus, 
  Shield, 
  Award, 
  Clock, 
  CheckCircle2, 
  HelpCircle,
  Briefcase,
  AlertCircle
} from "lucide-react";

interface TeamRosterTabProps {
  teams: WorkshopTeam[];
  employees: WorkshopEmployee[];
  onRefresh?: () => void;
}

export function TeamRosterTab({ teams, employees, onRefresh }: TeamRosterTabProps) {
  const [isPending, startTransition] = useTransition();
  const [transferStaff, setTransferStaff] = useState<WorkshopEmployee | null>(null);
  const [selectedTargetTeam, setSelectedTargetTeam] = useState<string>("");
  const [isLoan, setIsLoan] = useState<boolean>(false);
  const [loanNotes, setLoanNotes] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Group employees by team
  const teamMap = new Map<string, WorkshopEmployee[]>();
  teams.forEach(t => teamMap.set(t.id, []));
  const unassigned: WorkshopEmployee[] = [];

  employees.forEach(emp => {
    if (!emp.isActive || !emp.isWorkshopStaff) return;
    if (emp.teamId && teamMap.has(emp.teamId)) {
      teamMap.get(emp.teamId)!.push(emp);
    } else {
      unassigned.push(emp);
    }
  });

  const handleOpenTransfer = (emp: WorkshopEmployee) => {
    setTransferStaff(emp);
    setSelectedTargetTeam(emp.teamId === 'team-alex' ? 'team-loc' : 'team-alex');
    setIsLoan(false);
    setLoanNotes("");
    setStatusMessage(null);
  };

  const handleExecuteTransfer = () => {
    if (!transferStaff) return;

    startTransition(async () => {
      setStatusMessage(null);
      const res = await assignEmployeeToTeamAction(
        transferStaff.id,
        isLoan ? transferStaff.teamId : selectedTargetTeam,
        'member',
        isLoan,
        isLoan ? selectedTargetTeam : null,
        loanNotes
      );

      if (res.success) {
        setStatusMessage({ type: 'success', text: `Successfully updated assignment for ${transferStaff.fullName}` });
        setTimeout(() => {
          setTransferStaff(null);
          if (onRefresh) onRefresh();
        }, 800);
      } else {
        setStatusMessage({ type: 'error', text: res.error || "Failed to update team assignment." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Informational Guidance Banner */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-start justify-between gap-4">
        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span>Workshop Team Directory & Dynamic Rostering</span>
          </div>
          <div>
            Chadwick workshop operates under Team Leaders <strong>Alex Alvarado</strong> and <strong>Loc Lu</strong>. 
            Team memberships are fully editable below. Workers can be permanently reassigned or designated as temporary support loans without modifying WorkGuru core data.
          </div>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {teams.map(team => {
          const members = teamMap.get(team.id) || [];
          const isAlex = team.id === 'team-alex';

          return (
            <div 
              key={team.id}
              className={`rounded-2xl border p-5 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between ${
                isAlex ? 'border-emerald-200 dark:border-emerald-900/50' : 'border-blue-200 dark:border-blue-900/50'
              }`}
            >
              <div>
                {/* Team Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isAlex ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300'
                    }`}>
                      {team.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">
                        {team.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Team Leader: <strong className="text-slate-700 dark:text-slate-200">{team.leaderName || 'Unassigned'}</strong>
                      </p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    isAlex 
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60' 
                      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/60'
                  }`}>
                    {members.length} members
                  </span>
                </div>

                {/* Team Members List */}
                <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/60">
                  {members.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No staff currently assigned to this team.
                    </div>
                  ) : (
                    members.map(member => (
                      <div 
                        key={member.id} 
                        className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                              {member.fullName}
                            </span>
                            {member.teamRole === 'leader' && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                                Leader
                              </span>
                            )}
                            {member.isApprentice && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400">
                                Apprentice
                              </span>
                            )}
                            {member.isTemporaryLoan && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                                Loaned Out
                              </span>
                            )}
                          </div>

                          {/* Skill Tags */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {member.skills.frameAssembly && (
                              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                                Frame ({(member.skills.frameAssembly * 100).toFixed(0)}%)
                              </span>
                            )}
                            {member.skills.busbar && (
                              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                                Busbar ({(member.skills.busbar * 100).toFixed(0)}%)
                              </span>
                            )}
                            {member.skills.wiring && (
                              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                                Wiring ({(member.skills.wiring * 100).toFixed(0)}%)
                              </span>
                            )}
                            {member.skills.testing && (
                              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                                Test ({(member.skills.testing * 100).toFixed(0)}%)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Transfer Action */}
                        <button
                          onClick={() => handleOpenTransfer(member)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/60 dark:hover:text-blue-400 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>Transfer</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex justify-between items-center">
                <span>Standard Shift: Mon-Wed 10h, Thu 8h</span>
                <span>Active Workshop Roster</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unassigned / Floating Pool */}
      {unassigned.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Unassigned Workshop Employees ({unassigned.length})
              </h3>
              <p className="text-xs text-slate-500">
                Staff imported from WorkGuru who have not yet been assigned to Alex's or Loc's team.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            {unassigned.map(emp => (
              <div 
                key={emp.id}
                className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white truncate max-w-[160px]">
                    {emp.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    ID #{emp.id} • Rate: ${emp.hourlyRate}/h
                  </div>
                </div>

                <button
                  onClick={() => handleOpenTransfer(emp)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3 h-3" /> Assign
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transfer / Loan Modal */}
      {transferStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Team Transfer / Support Loan
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Assign <strong className="text-slate-800 dark:text-slate-200">{transferStaff.fullName}</strong> to a team or loan as temporary support.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Team
                </label>
                <select
                  value={selectedTargetTeam}
                  onChange={e => setSelectedTargetTeam(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (Leader: {t.leaderName})</option>
                  ))}
                  <option value="">Unassigned Pool</option>
                </select>
              </div>

              {/* Temporary Loan Checkbox */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={isLoan}
                    onChange={e => setIsLoan(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Designate as Temporary Loan</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Temporarily loans worker capacity to target team while preserving their primary team assignment.
                </p>

                {isLoan && (
                  <input
                    type="text"
                    value={loanNotes}
                    onChange={e => setLoanNotes(e.target.value)}
                    placeholder="Reason (e.g. Rush switchgear mounting on Job #24017)"
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                  />
                )}
              </div>
            </div>

            {statusMessage && (
              <div className={`p-2.5 rounded-lg text-xs font-medium ${
                statusMessage.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' 
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
              }`}>
                {statusMessage.text}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTransferStaff(null)}
                disabled={isPending}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                disabled={isPending}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
