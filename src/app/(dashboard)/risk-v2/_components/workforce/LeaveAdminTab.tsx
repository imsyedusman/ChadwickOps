"use client";

import React, { useState, useTransition } from "react";
import { 
  LeaveRequestV2, 
  WorkshopEmployee, 
  LeaveType, 
  LeaveStatus 
} from "@/lib/risk-v2/workforce";
import { 
  submitLeaveRequestAction, 
  updateLeaveStatusAction 
} from "@/actions/workforce-v2";
import { 
  FileText, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  User, 
  Check, 
  X,
  FileCheck2
} from "lucide-react";

interface LeaveAdminTabProps {
  leaveRequests: LeaveRequestV2[];
  employees: WorkshopEmployee[];
  onRefresh?: () => void;
}

export function LeaveAdminTab({ leaveRequests, employees, onRefresh }: LeaveAdminTabProps) {
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form State
  const [staffId, setStaffId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isPartialDay, setIsPartialDay] = useState<boolean>(false);
  const [partialHours, setPartialHours] = useState<number>(4);
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [notes, setNotes] = useState<string>("");
  const [directApprove, setDirectApprove] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Rejection modal
  const [rejectingLeaveId, setRejectingLeaveId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  const activeEmployees = employees.filter(e => e.isActive && e.isWorkshopStaff);

  const filteredLeaves = leaveRequests.filter(l => {
    if (statusFilter === "all") return true;
    return l.status === statusFilter;
  });

  const handleOpenAddModal = () => {
    setStaffId(activeEmployees[0]?.id ? String(activeEmployees[0].id) : "");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate(new Date().toISOString().slice(0, 10));
    setIsPartialDay(false);
    setPartialHours(4);
    setLeaveType("annual");
    setNotes("");
    setDirectApprove(false);
    setErrorMessage("");
    setShowAddModal(true);
  };

  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId) {
      setErrorMessage("Please select an employee.");
      return;
    }
    if (!startDate || !endDate) {
      setErrorMessage("Start and end dates are required.");
      return;
    }
    if (startDate > endDate) {
      setErrorMessage("Start date cannot be after end date.");
      return;
    }

    startTransition(async () => {
      setErrorMessage("");
      const res = await submitLeaveRequestAction({
        staffId: Number(staffId),
        startDate,
        endDate,
        isPartialDay,
        partialHours: isPartialDay ? partialHours : undefined,
        leaveType,
        notes,
        initialStatus: directApprove ? 'approved' : 'pending',
      });

      if (res.success) {
        setShowAddModal(false);
        if (onRefresh) onRefresh();
      } else {
        setErrorMessage(res.error || "Failed to record leave.");
      }
    });
  };

  const handleUpdateStatus = (leaveId: string, newStatus: LeaveStatus, reason?: string) => {
    startTransition(async () => {
      const res = await updateLeaveStatusAction(leaveId, newStatus, reason);
      if (res.success) {
        setRejectingLeaveId(null);
        setRejectionReason("");
        if (onRefresh) onRefresh();
      } else {
        alert(res.error || "Failed to update leave status.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Informational Workflow Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60">
        <div className="space-y-1 text-xs text-amber-900 dark:text-amber-300">
          <div className="font-bold flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Workshop Paper & PDF Leave Intake Workflow</span>
          </div>
          <div>
            Workshop staff do not have Microsoft 365 accounts and submit leave on paper forms or PDFs. 
            Joe and Farina record and authorize requests here. Approved leave automatically updates capacity; pending leave is surfaced as a risk.
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Record Paper/PDF Form</span>
        </button>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          {[
            { id: 'all', label: 'All Requests', count: leaveRequests.length },
            { id: 'pending', label: 'Pending Review', count: leaveRequests.filter(l => l.status === 'pending').length },
            { id: 'approved', label: 'Approved', count: leaveRequests.filter(l => l.status === 'approved').length },
            { id: 'rejected', label: 'Rejected', count: leaveRequests.filter(l => l.status === 'rejected').length },
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
          Showing <strong>{filteredLeaves.length}</strong> record(s)
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Date Range</th>
                <th className="py-3 px-3">Duration / Type</th>
                <th className="py-3 px-3">Intake Note / Reason</th>
                <th className="py-3 px-3">Submitted</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No leave requests match the selected status filter.
                  </td>
                </tr>
              ) : (
                filteredLeaves.map(leave => (
                  <tr key={leave.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    {/* Employee */}
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {leave.staffName}
                      <div className="text-[10px] text-slate-400 font-normal">ID #{leave.staffId}</div>
                    </td>

                    {/* Dates */}
                    <td className="py-3 px-3 font-mono">
                      <div className="font-semibold text-slate-900 dark:text-slate-200">{leave.startDate}</div>
                      {leave.startDate !== leave.endDate && (
                        <div className="text-[10px] text-slate-400">to {leave.endDate}</div>
                      )}
                    </td>

                    {/* Duration / Type */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                        {leave.leaveType} Leave
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {leave.isPartialDay ? `Partial Day (${leave.partialHours}h)` : "Full Day Shift"}
                      </div>
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-3 max-w-[200px] truncate text-slate-600 dark:text-slate-400">
                      {leave.notes || "—"}
                      {leave.rejectionReason && (
                        <div className="text-[10px] text-rose-500 font-medium truncate">
                          Rejected: {leave.rejectionReason}
                        </div>
                      )}
                    </td>

                    {/* Submitted by */}
                    <td className="py-3 px-3 text-slate-500">
                      <div>{leave.submittedBy}</div>
                      <div className="text-[10px] text-slate-400">{leave.submittedAt.slice(0, 10)}</div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        leave.status === 'approved'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : leave.status === 'pending'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                          : leave.status === 'rejected'
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {leave.status.toUpperCase()}
                      </span>
                    </td>

                    {/* Review Actions */}
                    <td className="py-3 px-4 text-right">
                      {leave.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleUpdateStatus(leave.id, 'approved')}
                            disabled={isPending}
                            className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                          <button
                            onClick={() => {
                              setRejectingLeaveId(leave.id);
                              setRejectionReason("");
                            }}
                            disabled={isPending}
                            className="px-2.5 py-1 text-[11px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <X className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          Reviewed by {leave.reviewedBy || 'Manager'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Leave Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-amber-500" />
                  Record Paper / PDF Leave Form
                </h3>
                <p className="text-xs text-slate-500">
                  Manager intake for workshop staff leave requests
                </p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Workshop Employee *
                </label>
                <select
                  value={staffId}
                  onChange={e => setStaffId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Leave Type
                  </label>
                  <select
                    value={leaveType}
                    onChange={e => setLeaveType(e.target.value as LeaveType)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="annual">Annual Leave</option>
                    <option value="sick">Sick / Carer's Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                    <option value="other">Other Absence</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Absence Duration
                  </label>
                  <div className="flex items-center gap-2 pt-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPartialDay}
                        onChange={e => setIsPartialDay(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>Partial Day</span>
                    </label>
                    {isPartialDay && (
                      <input
                        type="number"
                        min="0.5"
                        max="10"
                        step="0.5"
                        value={partialHours}
                        onChange={e => setPartialHours(Number(e.target.value))}
                        className="w-16 text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Intake Notes / Paper Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paper leave form signed 14/10, approved verbally by Farina"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Direct Approval Checkbox */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={directApprove}
                    onChange={e => setDirectApprove(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Authorize immediately as Approved Leave</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-1">
                  If unchecked, request is saved as Pending Review for Joe / Farina authorization.
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
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Record Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingLeaveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Reject Leave Request
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Provide a reason for rejecting this leave request.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Rejection Reason
              </label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g. Critical factory deadline on switchboard build #24017"
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingLeaveId(null)}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus(rejectingLeaveId, 'rejected', rejectionReason)}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
