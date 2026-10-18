"use client";

import React, { useState, useTransition } from "react";
import { 
  ProjectReadinessAssessment, 
  MaterialRequirementType 
} from "@/lib/risk-v2/readiness";
import { saveProjectMaterialConfirmation } from "@/actions/capacity-v2";
import { 
  X, 
  Calendar, 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Layers, 
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Truck,
  Building,
  Info
} from "lucide-react";

interface ReadinessDetailModalProps {
  project: ProjectReadinessAssessment | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function ReadinessDetailModal({ project, onClose, onSaved }: ReadinessDetailModalProps) {
  const [isPending, startTransition] = useTransition();
  const [requirement, setRequirement] = useState<MaterialRequirementType>(
    project?.materialRequirement || 'unknown'
  );
  const [notes, setNotes] = useState<string>(project?.confirmationDetails?.notes || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!project) return null;

  const handleSaveConfirmation = () => {
    startTransition(async () => {
      setSaveStatus('idle');
      setErrorMessage('');
      const res = await saveProjectMaterialConfirmation(project.projectId, {
        requirement,
        notes,
      });

      if (res.success) {
        setSaveStatus('success');
        if (onSaved) onSaved();
      } else {
        setSaveStatus('error');
        setErrorMessage(res.error || 'Failed to save requirement confirmation.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-mono text-xs font-bold border border-blue-200/60 dark:border-blue-800/60">
                {project.projectNumber}
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate max-w-md">
                {project.name}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Client: <span className="font-semibold text-slate-700 dark:text-slate-300">{project.clientName || 'N/A'}</span> • PM: <span className="font-semibold text-slate-700 dark:text-slate-300">{project.projectManager || 'Unassigned'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Key Dates & Backward Planning Conflict Banner */}
          {project.isMaterialDelayConflict && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 dark:text-rose-300">
                <span className="font-bold">Material Delay Conflict:</span> Earliest estimated material arrival ({project.earliestEstimatedMaterialStartDate || 'TBD'}) is later than the latest manufacturing start needed ({project.latestRequiredManufacturingStartDate || 'TBD'}) to meet the customer's delivery deadline ({project.deliveryDate || 'No deadline'}).
              </div>
            </div>
          )}

          {project.isStartDateOverdue && !project.isMaterialDelayConflict && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <span className="font-bold">Provisional Start Date Overdue:</span> To meet customer delivery on {project.deliveryDate || 'N/A'}, manufacturing ideally should have started by {project.latestRequiredManufacturingStartDate || 'N/A'}.
              </div>
            </div>
          )}

          {/* Timeline Cards Grid: 4 distinct planning dates + customer delivery */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Latest Required Start
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                {project.latestRequiredManufacturingStartDate || 'Not determinable'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Provisional (backward-planned at 25h/day)
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Confirmed Material Start
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                {project.earliestConfirmedMaterialStartDate || 'Awaiting Delivery'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Strictly physical receipts / confirmed
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-500" />
                Estimated Supplier ETA
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                {project.earliestEstimatedMaterialStartDate || 'No ETA recorded'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Provisional supplier estimate
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-purple-500" />
                Customer Delivery Date
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                {project.deliveryDate || 'Unscheduled / Missing'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Customer delivery deadline
              </div>
            </div>
          </div>

          {/* Readiness Status & Component Breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Readiness & Material Gate Status
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Drawings */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Drawings</span>
                  {project.drawingStatus === 'approved' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                      Approved
                    </span>
                  ) : project.drawingStatus === 'pending_approval' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                      Pending
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                      Missing
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {project.drawingApprovalDate ? (
                    <span>Approved: <strong className="text-slate-700 dark:text-slate-200">{project.drawingApprovalDate}</strong></span>
                  ) : project.expectedDrawingApprovalDate ? (
                    <span>Expected: <strong className="text-slate-700 dark:text-slate-200">{project.expectedDrawingApprovalDate}</strong></span>
                  ) : (
                    <span>No drawing dates recorded</span>
                  )}
                </div>
              </div>

              {/* Sheetmetal */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Sheetmetal</span>
                  {project.sheetmetalStatus === 'delivered' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                      Delivered
                    </span>
                  ) : project.sheetmetalStatus === 'ordered_with_eta' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                      ETA Set
                    </span>
                  ) : project.sheetmetalStatus === 'not_required' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      Not Required
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                      Awaiting
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {project.sheetmetalDeliveredDate ? (
                    <span>Delivered: <strong className="text-slate-700 dark:text-slate-200">{project.sheetmetalDeliveredDate}</strong></span>
                  ) : project.sheetmetalExpectedDate ? (
                    <span>Expected: <strong className="text-slate-700 dark:text-slate-200">{project.sheetmetalExpectedDate}</strong></span>
                  ) : project.sheetmetalOrderedDate ? (
                    <span>Ordered: <strong className="text-slate-700 dark:text-slate-200">{project.sheetmetalOrderedDate}</strong> (No ETA)</span>
                  ) : (
                    <span>{project.sheetmetalStatus === 'not_required' ? 'Not required for this project' : 'Not ordered'}</span>
                  )}
                </div>
              </div>

              {/* Switchgear */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Switchgear</span>
                  {project.switchgearStatus === 'delivered' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                      Delivered
                    </span>
                  ) : project.switchgearStatus === 'ordered_with_eta' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                      ETA Set
                    </span>
                  ) : project.switchgearStatus === 'not_required' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      Not Required
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                      Awaiting
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {project.switchgearDeliveredDate ? (
                    <span>Delivered: <strong className="text-slate-700 dark:text-slate-200">{project.switchgearDeliveredDate}</strong></span>
                  ) : project.switchgearExpectedDate ? (
                    <span>Expected: <strong className="text-slate-700 dark:text-slate-200">{project.switchgearExpectedDate}</strong></span>
                  ) : project.switchgearOrderedDate ? (
                    <span>Ordered: <strong className="text-slate-700 dark:text-slate-200">{project.switchgearOrderedDate}</strong> (No ETA)</span>
                  ) : (
                    <span>{project.switchgearStatus === 'not_required' ? 'Not required for this project' : 'Not ordered'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Stage-Specific Gating Note */}
            <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 font-semibold">
                <Layers className="w-4 h-4 text-blue-500" />
                <span>Stage-Specific Manufacturing Readiness:</span>
              </div>
              <ul className="mt-2 space-y-1 list-disc list-inside text-xs text-slate-500 dark:text-slate-400">
                <li>
                  <strong className="text-slate-700 dark:text-slate-300">Stage 04 (Frame Assembly):</strong>{' '}
                  {project.canStartFraming ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">READY TO START (Sheetmetal available & Drawings approved)</span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400 font-medium">Blocked ({project.drawingStatus !== 'approved' ? 'Drawings pending' : 'Sheetmetal pending'})</span>
                  )}
                </li>
                <li>
                  <strong className="text-slate-700 dark:text-slate-300">Stage 05+ (Component Mounting & Wiring):</strong>{' '}
                  {project.canStartMountingAndWiring ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">READY TO START (Switchgear available)</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Awaiting switchgear arrival</span>
                  )}
                </li>
              </ul>
            </div>
          </div>

          {/* Editable Material Requirement Confirmation */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Planner Material Requirement Confirmation
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Override or confirm project-specific material dependencies. Saved without altering database schema.
                </p>
              </div>
              {project.isRequirementConfirmed && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  Confirmed by {project.confirmationDetails?.confirmedBy || 'Planner'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Required Materials
                </label>
                <select
                  value={requirement}
                  onChange={(e) => setRequirement(e.target.value as MaterialRequirementType)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="both">Both Sheetmetal & Switchgear Required</option>
                  <option value="sheetmetal_only">Sheetmetal Only (No Switchgear needed)</option>
                  <option value="switchgear_only">Switchgear Only (No Sheetmetal needed)</option>
                  <option value="neither">Neither Required (Engineering/Retrofit/Labor only)</option>
                  <option value="unknown">Unknown / Not Confirmed</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Planner Notes / Rationales
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Switchboard retrofit, customer free-issued sheetmetal"
                  className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs">
                {saveStatus === 'success' && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Requirement saved successfully.
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                    {errorMessage}
                  </span>
                )}
              </div>

              <button
                onClick={handleSaveConfirmation}
                disabled={isPending}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Save Requirement'}
              </button>
            </div>
          </div>

          {/* Linked Purchase Orders */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Linked Purchase Orders ({project.purchaseOrders.length})
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Reused from existing WorkGuru PO sync
              </span>
            </div>

            {project.purchaseOrders.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                No purchase orders linked to this project yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">PO Number</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Expected Delivery</th>
                      <th className="py-2.5 px-3">Actual Received</th>
                      <th className="py-2.5 px-3">Variance</th>
                      <th className="py-2.5 px-3 text-right">Total ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                    {project.purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                          {po.poNumber || `PO #${po.id}`}
                        </td>
                        <td className="py-2 px-3 font-medium">
                          {po.supplierName || 'Unspecified'}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            po.status.toLowerCase() === 'received'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : po.isOverdueETA
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                          }`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                          {po.expectedDate || 'None'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                          {po.receivedDate || '—'}
                        </td>
                        <td className="py-2 px-3">
                          {po.varianceDays !== null ? (
                            <span className={po.varianceDays > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400'}>
                              {po.varianceDays > 0 ? `+${po.varianceDays}d late` : `${po.varianceDays}d on time`}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          ${po.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center text-xs text-slate-500">
          <span>Production Planning & Readiness • Phase 2A</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
