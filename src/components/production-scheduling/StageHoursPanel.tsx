"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { getProjectStageHours, saveProjectStageHours, getProjectedLabourCost, getWorkerSuggestionsForProject, getWorkerAssignmentsForProject, assignWorkerToStage, deleteWorkerAssignment } from "@/app/actions/production-scheduling";
import { ChevronDown, ChevronRight, X, X as XIcon, Loader2, AlertTriangle } from "lucide-react";
import { format, differenceInWeeks, parseISO } from "date-fns";

interface StageHoursPanelProps {
  project: any;
  isOpen: boolean;
  onClose: () => void;
  canEdit: boolean;
  isFinance?: boolean;
}

export function StageHoursPanel({ project, isOpen, onClose, canEdit, isFinance = false }: StageHoursPanelProps) {
  const [stages, setStages] = useState<Record<string, { value: number | null; source: "wg" | "manual" | "none" }> | null>(null);
  const [costData, setCostData] = useState<any>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [workerSuggestions, setWorkerSuggestions] = useState<Record<string, any[]> | null>(null);
  const [assignments, setAssignments] = useState<Record<string, any[]> | null>(null);
  const [expandedSuggestions, setExpandedSuggestions] = useState<Record<string, boolean>>({});
  const [expandedFullList, setExpandedFullList] = useState<Record<string, boolean>>({});
  const [assignForms, setAssignForms] = useState<Record<string, boolean>>({});
  const [assignInputs, setAssignInputs] = useState<Record<string, { staffId: string, hours: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCostBreakdownOpen, setIsCostBreakdownOpen] = useState(false);

  const isIfm = useMemo(() => project?.projectType?.toUpperCase().includes("IFM") || false, [project?.projectType]);

  useEffect(() => {
    if (isOpen && project?.id) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const [hoursRes, costRes, suggestionsRes, assignmentsRes] = await Promise.all([
            getProjectStageHours(project.id),
            getProjectedLabourCost(project.id),
            getWorkerSuggestionsForProject(project.id),
            getWorkerAssignmentsForProject(project.id)
          ]);
          
          if (hoursRes.success && hoursRes.data) {
            setStages(hoursRes.data);
            setInputs({
              frame_assembly: hoursRes.data.frame_assembly.value?.toString() || "",
              switchgear_mount: hoursRes.data.switchgear_mount.value?.toString() || "",
              busbar: hoursRes.data.busbar.value?.toString() || "",
              wiring: hoursRes.data.wiring.value?.toString() || "",
              labels: hoursRes.data.labels.value?.toString() || "",
              testing: hoursRes.data.testing.value?.toString() || "",
              packaging_freight: hoursRes.data.packaging_freight.value?.toString() || "",
            });
          } else {
            toast.error(hoursRes.error || "Failed to load stage hours");
          }

          if (costRes.success && costRes.data) {
            setCostData(costRes.data);
          } else {
            toast.error(costRes.error || "Failed to load projected costs");
          }

          if (suggestionsRes.success && suggestionsRes.data) {
            setWorkerSuggestions(suggestionsRes.data);
          } else {
            toast.error(suggestionsRes.error || "Failed to load worker suggestions");
          }

          if (assignmentsRes.success && assignmentsRes.data) {
            setAssignments(assignmentsRes.data);
          } else {
            toast.error(assignmentsRes.error || "Failed to load assignments");
          }
        } catch (error: any) {
          toast.error(error.message || "Failed to load stage hours");
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen, project?.id]);

  const handleSave = async () => {
    if (!project?.id) return;
    setIsSaving(true);
    
    // Map to DB columns
    const payload: Record<string, any> = {
      switchgearMount: inputs.switchgear_mount ? parseFloat(inputs.switchgear_mount) : null,
      wiring: inputs.wiring ? parseFloat(inputs.wiring) : null,
      labels: inputs.labels ? parseFloat(inputs.labels) : null,
      testing: inputs.testing ? parseFloat(inputs.testing) : null,
      packagingFreight: inputs.packaging_freight ? parseFloat(inputs.packaging_freight) : null,
    };

    if (isIfm) {
      payload.frameAssemblyIfm = inputs.frame_assembly ? parseFloat(inputs.frame_assembly) : null;
      payload.busbarIfm = inputs.busbar ? parseFloat(inputs.busbar) : null;
    } else {
      payload.frameAssemblyIfc = inputs.frame_assembly ? parseFloat(inputs.frame_assembly) : null;
      payload.busbarIfc = inputs.busbar ? parseFloat(inputs.busbar) : null;
    }

    try {
      const res = await saveProjectStageHours(project.id, payload);
      if (res.success) {
        toast.success("Stage hours saved");
        onClose();
      } else {
        toast.error(res.error || "Failed to save stage hours");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save stage hours");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const handleInputChange = (key: string, value: string) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const toggleSuggestions = (key: string) => {
    setExpandedSuggestions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFullList = (key: string) => {
    setExpandedFullList(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getDbStageKey = (key: string) => {
    if (key === 'frame_assembly') return isIfm ? 'frame_assembly_ifm' : 'frame_assembly_ifc';
    if (key === 'busbar') return isIfm ? 'busbar_ifm' : 'busbar_ifc';
    return key;
  };

  const reloadAssignments = async () => {
    const res = await getWorkerAssignmentsForProject(project.id);
    if (res.success && res.data) {
      setAssignments(res.data);
    }
  };

  const handleAssignWorker = async (key: string) => {
    const input = assignInputs[key];
    if (!input || !input.staffId || !input.hours) {
      toast.error("Please select a worker and enter hours.");
      return;
    }
    
    setIsAssigning(true);
    const dbKey = getDbStageKey(key);
    
    try {
      const res = await assignWorkerToStage(project.id, dbKey, parseInt(input.staffId), parseFloat(input.hours));
      if (res.success) {
        toast.success("Worker assigned");
        setAssignForms(prev => ({ ...prev, [key]: false }));
        setAssignInputs(prev => ({ ...prev, [key]: { staffId: "", hours: "" } }));
        await reloadAssignments();
      } else {
        toast.error(res.error || "Failed to assign worker");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to assign worker");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: number) => {
    try {
      const res = await deleteWorkerAssignment(assignmentId);
      if (res.success) {
        toast.success("Assignment removed");
        await reloadAssignments();
      } else {
        toast.error(res.error || "Failed to remove assignment");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to remove assignment");
    }
  };

  const handleAssignInputChange = (key: string, field: 'staffId' | 'hours', value: string) => {
    setAssignInputs(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { staffId: "", hours: "" }),
        [field]: value
      }
    }));
  };

  const calculateTotal = () => {
    return Object.values(inputs).reduce((acc, val) => {
      const num = parseFloat(val);
      if (!isNaN(num)) return acc + num;
      return acc;
    }, 0);
  };

  const getSourceBadge = (source?: "wg" | "manual" | "none") => {
    if (source === "wg") {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 uppercase tracking-wider">WG</span>;
    }
    if (source === "manual") {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 uppercase tracking-wider">Manual</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-wider">No data</span>;
  };

  const renderRow = (key: string, label: string) => {
    const data = stages?.[key];
    const source = data?.source || "none";
    const hoursVal = parseFloat(inputs[key] || "0");
    const hasHours = !isNaN(hoursVal) && hoursVal > 0;
    
    const suggestions = workerSuggestions?.[key] || [];
    const isExpanded = expandedSuggestions[key] || false;
    
    return (
      <div key={key} className="py-4 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">{label}</label>
          {getSourceBadge(source)}
        </div>
        
        {canEdit ? (
          <div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={inputs[key] || ""}
              onChange={(e) => handleInputChange(key, e.target.value)}
              placeholder="0.00"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 font-mono"
            />
            {source === "wg" && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium mt-1">
                <AlertTriangle className="h-3 w-3" />
                Overriding WorkGuru value
              </p>
            )}
          </div>
        ) : (
          <div className="text-sm font-mono font-medium text-slate-900 dark:text-slate-100 mb-2">
            {inputs[key] ? `${inputs[key]} hrs` : "-"}
          </div>
        )}
        
        {hasHours && (
          <div className="mt-3">
            <button
              onClick={() => toggleSuggestions(key)}
              className="text-[11px] font-medium text-brand hover:text-brand/80 flex items-center gap-1 focus:outline-none"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {isExpanded ? "Hide suggested workers" : "Show suggested workers"}
            </button>
            
            {isExpanded && (
              <div className="mt-2 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100 dark:border-slate-800/80 p-2">
                {suggestions.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No rated staff for this stage</p>
                ) : (
                  <div>
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800/60">
                          <th className="pb-1 font-medium">Name</th>
                          <th className="pb-1 font-medium text-right">Efficiency</th>
                          <th className="pb-1 font-medium pl-3">Tier</th>
                          {isFinance && <th className="pb-1 font-medium text-right w-12"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {suggestions.slice(0, expandedFullList[key] ? suggestions.length : 5).map((w, idx) => (
                          <tr key={idx} className="group">
                            <td className="py-1.5 font-medium text-slate-700 dark:text-slate-300">
                              {w.full_name}
                            </td>
                            <td className="py-1.5 text-right font-mono text-slate-500">
                              {(w.efficiency_rating * 100).toFixed(0)}%
                            </td>
                            <td className="py-1.5 pl-3">
                              <div className="flex items-center gap-1.5">
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  w.tier === "Recommended" ? "bg-emerald-500" :
                                  w.tier === "Good" ? "bg-blue-500" :
                                  "bg-slate-400"
                                }`}></span>
                                <span className="text-slate-500">{w.tier}</span>
                              </div>
                            </td>
                            {isFinance && (
                              <td className="py-1.5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="font-mono text-[10px] text-slate-400">{w.cost_effectiveness_score.toFixed(1)}</span>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {suggestions.length > 5 && (
                      <button
                        onClick={() => toggleFullList(key)}
                        className="w-full text-center py-1.5 mt-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                      >
                        {expandedFullList[key] ? "Show less" : `Show ${suggestions.length - 5} more`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {hasHours && (
          <div className="mt-4">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Assigned Workers</h4>
            
            {(!assignments || !assignments[getDbStageKey(key)] || assignments[getDbStageKey(key)].length === 0) ? (
              <p className="text-[11px] text-slate-400 italic mb-2">No workers assigned</p>
            ) : (
              <div className="space-y-1 mb-2">
                {assignments[getDbStageKey(key)].map((a: any) => {
                  let weeks = 1;
                  if (a.projectedStart && a.projectedEnd) {
                    const diff = differenceInWeeks(parseISO(a.projectedEnd), parseISO(a.projectedStart));
                    weeks = diff > 0 ? diff : 1; // At least 1 week to avoid div by zero
                  }
                  const hrsPerWeek = (a.assignedHours / weeks).toFixed(1);
                  
                  return (
                    <div key={a.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-2 rounded border border-slate-100 dark:border-slate-800 text-[11px]">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{a.staffName}</span>
                        <span className="text-[10px] text-slate-500">{hrsPerWeek} hrs/week this project</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                          <span className="font-mono font-medium text-slate-600 dark:text-slate-400">{a.assignedHours} hrs</span>
                          <span className="text-[10px] text-slate-400">
                            {a.projectedStart && a.projectedEnd 
                              ? `${format(parseISO(a.projectedStart), 'dd MMM')} - ${format(parseISO(a.projectedEnd), 'dd MMM')}` 
                              : '-'}
                          </span>
                        </div>
                        {canEdit && (
                          <button 
                            onClick={() => handleRemoveAssignment(a.id)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Remove assignment"
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {canEdit && !assignForms[key] && (
              <button
                onClick={() => {
                  const dbKey = getDbStageKey(key);
                  const assignedSoFar = assignments?.[dbKey]?.reduce((sum, a) => sum + parseFloat(a.assignedHours), 0) || 0;
                  const remaining = Math.max(0, hoursVal - assignedSoFar);
                  
                  setAssignForms(prev => ({ ...prev, [key]: true }));
                  setAssignInputs(prev => ({ 
                    ...prev, 
                    [key]: { staffId: "", hours: remaining > 0 ? remaining.toFixed(2) : "" } 
                  }));
                }}
                className="text-[11px] font-medium text-brand hover:text-brand/80 border border-brand/20 hover:border-brand/40 bg-brand/5 px-3 py-1 rounded transition-colors"
              >
                + Assign Worker
              </button>
            )}

            {assignForms[key] && (
              <div className="mt-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-slate-500 mb-1 block">Select Worker</label>
                    <select
                      value={assignInputs[key]?.staffId || ""}
                      onChange={(e) => handleAssignInputChange(key, 'staffId', e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option value="" disabled>Select...</option>
                      {suggestions.map((w, idx) => {
                        // Find matching staff id from full staff list or pass it via suggestions
                        // Wait, suggestions only have full_name currently!
                        // Let's assume we can match by name for now or we need staffId in suggestions.
                        // I will add staff_id to suggestions in the next step, but for now I'll use index or try to find it.
                        // Actually I can just match staffId if it exists in suggestions... wait!
                        return (
                          <option key={idx} value={w.staff_id || w.full_name}>
                            {w.full_name} ({(w.efficiency_rating * 100).toFixed(0)}%)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-slate-500 mb-1 block">Hours</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={(() => {
                        const dbKey = getDbStageKey(key);
                        const assignedSoFar = assignments?.[dbKey]?.reduce((sum, a) => sum + parseFloat(a.assignedHours), 0) || 0;
                        return Math.max(0, hoursVal - assignedSoFar);
                      })()}
                      value={assignInputs[key]?.hours || ""}
                      onChange={(e) => handleAssignInputChange(key, 'hours', e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setAssignForms(prev => ({ ...prev, [key]: false }));
                    }}
                    className="text-[10px] font-medium px-3 py-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // We need staffId. Since select option value is staff_id || full_name, we can look up staff ID
                      const input = assignInputs[key];
                      const matched = suggestions.find(w => w.staff_id == input.staffId || w.full_name === input.staffId);
                      if (matched && matched.staff_id) {
                         handleAssignInputChange(key, 'staffId', matched.staff_id.toString());
                         // We have to wait for state to update, so better to pass directly
                         handleAssignWorkerDirect(key, matched.staff_id.toString(), input.hours);
                      } else if (matched && !matched.staff_id) {
                        toast.error("Error: Worker ID missing from suggestions.");
                      }
                    }}
                    disabled={isAssigning}
                    className="text-[10px] font-bold bg-brand text-white px-3 py-1.5 rounded hover:bg-brand/90 transition-colors disabled:opacity-50"
                  >
                    {isAssigning ? "Saving..." : "Confirm"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleAssignWorkerDirect = async (key: string, staffId: string, hours: string) => {
    if (!staffId || !hours) {
      toast.error("Please select a worker and enter hours.");
      return;
    }
    setIsAssigning(true);
    const dbKey = getDbStageKey(key);
    
    try {
      const res = await assignWorkerToStage(project.id, dbKey, parseInt(staffId), parseFloat(hours));
      if (res.success) {
        toast.success("Worker assigned");
        setAssignForms(prev => ({ ...prev, [key]: false }));
        setAssignInputs(prev => ({ ...prev, [key]: { staffId: "", hours: "" } }));
        await reloadAssignments();
      } else {
        toast.error(res.error || "Failed to assign worker");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to assign worker");
    } finally {
      setIsAssigning(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "-";
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[100] transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[420px] bg-white dark:bg-slate-900 shadow-2xl z-[101] flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {project?.projectNumber || "Unknown Project"}
              </h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${isIfm ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                {isIfm ? "IFM" : "IFC"}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium line-clamp-1">
              {project?.name || "No name"}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-2 bg-white dark:bg-slate-900">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
              <p className="text-sm font-medium">Loading stage hours...</p>
            </div>
          ) : (
            <div className="space-y-1">
              {renderRow("frame_assembly", isIfm ? "Frame Assembly IFM" : "Frame Assembly IFC")}
              {renderRow("switchgear_mount", "Switchgear Mount")}
              {renderRow("busbar", isIfm ? "Busbar IFM" : "Busbar IFC")}
              {renderRow("wiring", "Wiring")}
              {renderRow("labels", "Labels")}
              {renderRow("testing", "Testing")}
              {renderRow("packaging_freight", "Packaging and Freight")}
              
              <div className="pt-6 pb-6 mt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Total Hours</span>
                <span className="text-xl font-black text-brand font-mono">
                  {calculateTotal().toFixed(2)}
                </span>
              </div>
              
              {costData && (
                <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Labour Cost Estimate</h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Actual cost to date</span>
                      <span className={`font-mono font-medium text-slate-900 dark:text-white transition-all duration-300 ${!isFinance ? "filter blur-sm select-none" : ""}`}>
                        {formatCurrency(costData.actualCost)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-brand/5 dark:bg-brand/10 rounded-lg border border-brand/10 dark:border-brand/20">
                      <span className="text-xs font-bold text-brand uppercase tracking-widest">Projected remaining cost</span>
                      <span className={`font-mono font-bold text-brand transition-all duration-300 ${!isFinance ? "filter blur-sm select-none" : ""}`}>
                        {formatCurrency(costData.totalProjectedCost)}
                      </span>
                    </div>
                  </div>

                  {isFinance && (
                    <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setIsCostBreakdownOpen(!isCostBreakdownOpen)}
                        className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-none"
                      >
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Cost by stage</span>
                        {isCostBreakdownOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      </button>
                      
                      {isCostBreakdownOpen && (
                        <div className="p-3 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                          {[
                            { key: 'frameAssembly', label: isIfm ? 'Frame Assembly IFM' : 'Frame Assembly IFC' },
                            { key: 'switchgearMount', label: 'Switchgear Mount' },
                            { key: 'busbar', label: isIfm ? 'Busbar IFM' : 'Busbar IFC' },
                            { key: 'wiring', label: 'Wiring' },
                            { key: 'labels', label: 'Labels' },
                            { key: 'testing', label: 'Testing' },
                            { key: 'packagingFreight', label: 'Packaging and Freight' }
                          ].map((stage) => (
                            <div key={stage.key} className="flex justify-between py-2 items-center text-xs">
                              <span className="text-slate-500 dark:text-slate-400">{stage.label}</span>
                              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                {formatCurrency(costData.costs[stage.key])}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          {canEdit ? (
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors shadow-sm"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="flex items-center gap-2 bg-brand hover:bg-brand/90 text-white font-bold text-xs uppercase tracking-widest px-6 py-2.5 rounded-xl transition-all shadow-md shadow-brand/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Hours
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center font-medium italic">
              You do not have permission to edit stage hours.
            </p>
          )}
        </div>

      </div>
    </>
  );
}
