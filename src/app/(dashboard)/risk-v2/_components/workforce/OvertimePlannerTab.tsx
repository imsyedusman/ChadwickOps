"use client";

import React, { useState, useTransition } from "react";
import { 
  OvertimeShiftV2, 
  WorkshopEmployee, 
  OvertimeStatus 
} from "@/lib/risk-v2/workforce";
import { 
  saveOvertimeShiftAction, 
  updateOvertimeStatusAction 
} from "@/actions/workforce-v2";
import { 
  Zap, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar, 
  Check, 
  X,
  Briefcase
} from "lucide-react";

interface OvertimePlannerTabProps {
  overtimeShifts: OvertimeShiftV2[];
  employees: WorkshopEmployee[];
  onRefresh?: () => void;
}

export function OvertimePlannerTab({ overtimeShifts, employees, onRefresh }: OvertimePlannerTabProps) {
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form State
  const [staffId, setStaffId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [hours, setHours] = useState<number>(8);
  const [status, setStatus] = useState<OvertimeStatus>("proposed");
  const [projectNumber, setProjectNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const activeEmployees = employees.filter(e => e.isActive && e.isWorkshopStaff);

  const filteredShifts = overtimeShifts.filter(s => {
    if (statusFilter === "all") return true;
    return s.status === statusFilter;
  });

  const totalApprovedHours = overtimeShifts
    .filter(s => s.status === 'approved')
    .reduce((sum, s) => sum + s.hours, 0);

  const totalProposedHours = overtimeShifts
    .filter(s => s.status === 'proposed')
    .reduce((sum, s) => sum + s.hours, 0);

  const handleOpenAddModal = () => {
    setStaffId(activeEmployees[0]?.id ? String(activeEmployees[0].id) : "");
    // Default to coming Friday
    const d = new Date();
    d.setDate(d.getDate() + ((5 + 7 - d.getDay()) % 7 || 7));
    setDate(d.toISOString().slice(0, 10));
    setHours(8);
    setStatus("proposed");
    setProjectNumber("");
    setNotes("");
    setErrorMessage("");
    setShowAddModal(true);
  };

  const handleSaveOvertime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId) {
      setErrorMessage("Please select an employee.");
      return;
    }
    if (!date) {
      setErrorMessage("Date is required.");
      return;
    }
    if (!hours || hours <= 0 || hours > 16) {
      setErrorMessage("Hours must be between 0.5 and 16.");
      return;
    }

    startTransition(async () => {
      setErrorMessage("");
      const res = await saveOvertimeShiftAction({
        staffId: Number(staffId),
        date,
        hours,
        status,
        associatedProjectNumber: projectNumber ? projectNumber.trim() : undefined,
        notes: notes ? notes.trim() : undefined,
      });

      if (res.success) {
        setShowAddModal(false);
        if (onRefresh) onRefresh();
      } else {
        setErrorMessage(res.error || "Failed to save overtime shift.");
      }
    });
  };

  const handleUpdateStatus = (shiftId: string, newStatus: OvertimeStatus) => {
    startTransition(async () => {
      const res = await updateOvertimeStatusAction(shiftId, newStatus);
      if (res.success) {
        if (onRefresh) onRefresh();
      } else {
        alert(res.error || "Failed to update overtime shift.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs font-semibold text-slate-500">Approved Overtime</div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {totalApprovedHours}h
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Confirmed capacity added to factory shifts
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs font-semibold text-slate-500">Proposed Overtime</div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {totalProposedHours}h
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Pending manager review — does not inflate capacity
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-500">Workshop Shift Rules</div>
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
            Friday, Saturday & Sunday are strictly overtime. Not all 22 workers work overtime.
          </div>
          <button
            onClick={handleOpenAddModal}
            className="mt-2 w-full py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Plan Overtime Shift</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          {[
            { id: 'all', label: 'All Overtime', count: overtimeShifts.length },
            { id: 'proposed', label: 'Proposed', count: overtimeShifts.filter(s => s.status === 'proposed').length },
            { id: 'approved', label: 'Approved', count: overtimeShifts.filter(s => s.status === 'approved').length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500">
          Showing <strong>{filteredShifts.length}</strong> shift(s)
        </div>
      </div>

      {/* Shifts Table */}
      <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Overtime Hours</th>
                <th className="py-3 px-3">Project Reference</th>
                <th className="py-3 px-3">Notes</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No overtime shifts recorded. Click "Plan Overtime Shift" to propose weekend or extra shifts.
                  </td>
                </tr>
              ) : (
                filteredShifts.map(shift => (
                  <tr key={shift.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    {/* Employee */}
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {shift.staffName}
                      <div className="text-[10px] text-slate-400 font-normal">ID #{shift.staffId}</div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-3 font-mono font-semibold text-slate-900 dark:text-slate-200">
                      {shift.date}
                    </td>

                    {/* Hours */}
                    <td className="py-3 px-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                      +{shift.hours}h
                    </td>

                    {/* Project */}
                    <td className="py-3 px-3">
                      {shift.associatedProjectNumber ? (
                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {shift.associatedProjectNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400">General Workshop</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-3 max-w-[200px] truncate text-slate-500">
                      {shift.notes || "—"}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        shift.status === 'approved'
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                      }`}>
                        {shift.status.toUpperCase()}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      {shift.status === 'proposed' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleUpdateStatus(shift.id, 'approved')}
                            disabled={isPending}
                            className="px-2.5 py-1 text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(shift.id, 'cancelled')}
                            disabled={isPending}
                            className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(shift.id, 'cancelled')}
                          disabled={isPending}
                          className="px-2 py-0.5 text-[10px] font-semibold text-rose-500 hover:bg-rose-50 rounded transition-colors"
                        >
                          Cancel Shift
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Overtime Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  Plan Overtime Shift
                </h3>
                <p className="text-xs text-slate-500">
                  Assign extra weekend or extended shift capacity
                </p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOvertime} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Workshop Employee *
                </label>
                <select
                  value={staffId}
                  onChange={e => setStaffId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {activeEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.teamId === 'team-alex' ? "Alex's Team" : emp.teamId === 'team-loc' ? "Loc's Team" : "Unassigned"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Shift Date *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Overtime Hours *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    step="0.5"
                    value={hours}
                    onChange={e => setHours(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Associated Project (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 24017 or Switchboard Main Incomer"
                  value={projectNumber}
                  onChange={e => setProjectNumber(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Shift Notes / Rationale
                </label>
                <input
                  type="text"
                  placeholder="e.g. Saturday wiring catchup for Joe delivery deadline"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/60">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-purple-900 dark:text-purple-300">
                  <input
                    type="checkbox"
                    checked={status === 'approved'}
                    onChange={e => setStatus(e.target.checked ? 'approved' : 'proposed')}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Authorize immediately as Approved Overtime</span>
                </label>
                <p className="text-[11px] text-purple-700 dark:text-purple-400 mt-1">
                  If unchecked, overtime remains Proposed and does not increase factory capacity until authorized.
                </p>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save Overtime Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
