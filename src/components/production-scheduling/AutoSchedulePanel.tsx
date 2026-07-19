"use client";

import { useState } from "react";
import { Wand2, Loader2, CheckCircle2, X, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { previewAutoSchedule, applyAutoSchedule, undoAutoSchedule } from "@/app/actions/production-scheduling";
import type { AutoScheduleResult, SchedulingSummary } from "@/lib/auto-scheduler";
import type { ProjectSchedulingData } from "@/app/actions/production-scheduling";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AutoSchedulePanelProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectSchedulingData[];
}

type ModalState = "PREVIEW" | "APPLYING" | "COMPLETE";

export function AutoSchedulePanel({ isOpen, onClose, projects }: AutoSchedulePanelProps) {
  const router = useRouter();
  const [modalState, setModalState] = useState<ModalState>("PREVIEW");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ schedule: AutoScheduleResult[]; summary: SchedulingSummary } | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  
  // Stats for complete state
  const [appliedCount, setAppliedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [assignmentsCreated, setAssignmentsCreated] = useState(0);

  const [isUndoLoading, setIsUndoLoading] = useState(false);
  const [undoResult, setUndoResult] = useState<{ cleared: number, workerAssignmentsCleared: number } | null>(null);

  const handleGeneratePreview = async () => {
    setIsPreviewLoading(true);
    try {
      const res = await previewAutoSchedule();
      if (res.success) {
        setPreviewData(res.data);
        setSelectedProjectIds(new Set(res.data.schedule.map(s => s.projectId)));
      } else {
        toast.error(res.error || "Failed to generate preview");
      }
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const filteredPreviewSchedule = previewData?.schedule.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.projectNumber.toLowerCase().includes(q) || s.projectName.toLowerCase().includes(q);
  }) || [];

  const handleToggleSelectAll = (checked: boolean) => {
    if (!previewData) return;
    const next = new Set(selectedProjectIds);
    if (checked) {
      filteredPreviewSchedule.forEach(s => next.add(s.projectId));
    } else {
      filteredPreviewSchedule.forEach(s => next.delete(s.projectId));
    }
    setSelectedProjectIds(next);
  };

  const handleToggleSelectProject = (projectId: number, checked: boolean) => {
    const next = new Set(selectedProjectIds);
    if (checked) {
      next.add(projectId);
    } else {
      next.delete(projectId);
    }
    setSelectedProjectIds(next);
  };

  const handleApply = async () => {
    if (selectedProjectIds.size === 0) {
      toast.warning("Please select at least one project to schedule.");
      return;
    }
    
    setModalState("APPLYING");
    try {
      const selectedIds = Array.from(selectedProjectIds);
      const res = await applyAutoSchedule(selectedIds);
      if (res.success) {
        setAppliedCount(res.data.applied);
        setSkippedCount(res.data.skipped);
        setAssignmentsCreated(res.data.workerAssignmentsCreated);
        setModalState("COMPLETE");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to apply auto-schedule");
        setModalState("PREVIEW");
      }
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred");
      setModalState("PREVIEW");
    }
  };

  const handleUndo = async () => {
    setIsUndoLoading(true);
    try {
      const res = await undoAutoSchedule();
      if (res.success) {
        setUndoResult(res.data);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to undo auto-schedule");
      }
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred");
    } finally {
      setIsUndoLoading(false);
    }
  };

  const handleCloseComplete = () => {
    onClose();
    // Reset state
    setModalState("PREVIEW");
    setPreviewData(null);
    setSelectedProjectIds(new Set());
    setUndoResult(null);
    router.refresh();
  };

  const getStatusClasses = (status: string | null) => {
    if (!status) return "bg-slate-100 text-slate-600";
    return "bg-brand/10 text-brand border-brand/20 dark:bg-brand/20 dark:text-brand-300 dark:border-brand/30 border shadow-sm";
  };

  const formatWeekString = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      return format(parseISO(dateStr), "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && modalState !== "APPLYING") {
        if (modalState === "COMPLETE") {
          handleCloseComplete();
        } else {
          onClose();
        }
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        
        {/* Header */}
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
            <Wand2 className="w-5 h-5 text-brand" />
            Auto-Schedule Suggestion
          </DialogTitle>
        </DialogHeader>

        {/* State 1: Preview */}
        {modalState === "PREVIEW" && (
          <div className="flex flex-col flex-1 overflow-hidden min-h-0 pt-4">
            {!previewData ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-6">
                <div className="p-4 bg-brand/5 dark:bg-brand/10 rounded-full border border-brand/10">
                  <Wand2 className="w-12 h-12 text-brand" />
                </div>
                <div className="max-w-md space-y-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">Generate Auto-Schedule Preview</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    The system will suggest start dates for all unscheduled projects based on due dates, material delivery, and available floor capacity. Your manually scheduled projects will not be affected.
                  </p>
                </div>
                <button
                  onClick={handleGeneratePreview}
                  disabled={isPreviewLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPreviewLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Preview...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Generate Preview
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col flex-1 overflow-hidden min-h-0 gap-4">
                
                {/* Summary Row */}
                <div className="p-3 bg-brand/5 border border-brand/10 dark:bg-brand/20 dark:border-brand/30 rounded-xl text-sm text-slate-700 dark:text-slate-200 font-medium flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    {previewData.summary.totalScheduled} projects will be scheduled · {previewData.summary.overdueCount} overdue projects prioritised · Busiest week: {formatWeekString(previewData.summary.highestLoadWeek)}
                  </div>
                  <div className="relative w-full md:w-64 shrink-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Table Container */}
                <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <Checkbox
                            checked={filteredPreviewSchedule.length > 0 && filteredPreviewSchedule.every(s => selectedProjectIds.has(s.projectId))}
                            onChange={handleToggleSelectAll}
                          />
                        </th>
                        <th className="p-3 text-xs font-bold uppercase tracking-wider text-slate-500">Project</th>
                        <th className="p-3 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                        <th className="p-3 text-xs font-bold uppercase tracking-wider text-slate-500">Suggested Start</th>
                        <th className="p-3 text-xs font-bold uppercase tracking-wider text-slate-500">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredPreviewSchedule.map((row) => {
                        const proj = projects.find(p => p.id === row.projectId);
                        const status = proj?.rawStatus || "";
                        const isChecked = selectedProjectIds.has(row.projectId);

                        return (
                          <tr 
                            key={row.projectId}
                            className={cn(
                              "hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-sm",
                              !isChecked && "opacity-55"
                            )}
                          >
                            <td className="p-3 text-center">
                              <Checkbox
                                checked={isChecked}
                                onChange={(checked) => handleToggleSelectProject(row.projectId, checked)}
                              />
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {row.projectNumber}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                                {row.projectName}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold inline-block border", getStatusClasses(status))}>
                                {status}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                              {format(parseISO(row.suggestedStart), "dd MMM yyyy")}
                            </td>
                            <td className="p-3 text-xs text-slate-500 dark:text-slate-400 max-w-[280px]">
                              {row.reason}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-4 shrink-0">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {selectedProjectIds.size} of {previewData.schedule.length} projects selected
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-sm font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApply}
                      disabled={selectedProjectIds.size === 0}
                      className="px-4 py-2 bg-brand text-white hover:bg-brand/90 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors"
                    >
                      Apply Selected
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* State 2: Applying or Undo Loading */}
        {(modalState === "APPLYING" || isUndoLoading) && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 flex-1">
            <Loader2 className="w-10 h-10 animate-spin text-brand" />
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">
              {isUndoLoading ? "Undoing auto-schedule..." : `Scheduling ${selectedProjectIds.size} projects...`}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isUndoLoading ? "Clearing auto-scheduled start dates." : "Applying capacity calculations and saving dates."}
            </p>
          </div>
        )}

        {/* State 3: Complete */}
        {modalState === "COMPLETE" && !isUndoLoading && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-6 flex-1">
            <div className={cn(
              "p-4 rounded-full border",
              undoResult 
                ? "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50" 
                : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50"
            )}>
              <CheckCircle2 className={cn("w-12 h-12", undoResult ? "text-amber-500" : "text-emerald-500")} />
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                {undoResult ? "Auto-Schedule Undone" : "Auto-Schedule Complete"}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">
                {undoResult 
                  ? `${undoResult.cleared} auto-scheduled projects and ${undoResult.workerAssignmentsCleared} worker assignments have been cleared.`
                  : skippedCount > 0 
                    ? `${appliedCount} projects scheduled successfully, ${assignmentsCreated} worker assignments created. ${skippedCount} projects skipped (already manually scheduled).`
                    : `${appliedCount} projects scheduled successfully, ${assignmentsCreated} worker assignments created.`
                }
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                The Gantt chart has been updated.
              </p>
            </div>
            <div className="flex gap-3">
              {!undoResult && (
                <button
                  onClick={handleUndo}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-sm font-semibold transition-colors"
                >
                  Undo Auto-Schedule
                </button>
              )}
              <button
                onClick={handleCloseComplete}
                className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
