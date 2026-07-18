"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getProjectStageHours, saveProjectStageHours, getProjectedLabourCost } from "@/app/actions/production-scheduling";
import { BlurredValue } from "@/components/ui/BlurredValue";
import { ChevronDown, ChevronRight } from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCostBreakdownOpen, setIsCostBreakdownOpen] = useState(false);

  const isIfm = useMemo(() => project?.projectType?.toUpperCase().includes("IFM") || false, [project?.projectType]);

  useEffect(() => {
    if (isOpen && project?.id) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const [hoursRes, costRes] = await Promise.all([
            getProjectStageHours(project.id),
            getProjectedLabourCost(project.id)
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
          <div className="text-sm font-mono font-medium text-slate-900 dark:text-slate-100">
            {inputs[key] ? `${inputs[key]} hrs` : "-"}
          </div>
        )}
      </div>
    );
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
                      <BlurredValue 
                        isBlurred={!isFinance} 
                        value={formatCurrency(costData.actualCost)} 
                        className="font-mono font-medium text-slate-900 dark:text-white"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-brand/5 dark:bg-brand/10 rounded-lg border border-brand/10 dark:border-brand/20">
                      <span className="text-xs font-bold text-brand uppercase tracking-widest">Projected remaining cost</span>
                      <BlurredValue 
                        isBlurred={!isFinance} 
                        value={formatCurrency(costData.totalProjectedCost)} 
                        className="font-mono font-bold text-brand"
                      />
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
