"use client";

import React, { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { CapacitySettingsV2 } from "@/lib/risk-v2/types";
import { saveCapacitySettingsV2 } from "@/actions/capacity-v2";
import { 
  SlidersHorizontal, 
  Users, 
  Clock, 
  Percent, 
  AlertTriangle, 
  Calendar, 
  Plus, 
  Trash2,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

interface CapacitySettingsModalProps {
  settings: CapacitySettingsV2;
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: (newSettings: CapacitySettingsV2) => void;
}

export function CapacitySettingsModal({
  settings,
  isOpen,
  onClose,
  onSettingsUpdated,
}: CapacitySettingsModalProps) {
  const [formData, setFormData] = useState<CapacitySettingsV2>({
    ...settings,
    workingPattern: { ...settings.workingPattern },
    factoryClosures: [...settings.factoryClosures],
  });

  const [newClosureDate, setNewClosureDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const weeklyHours = 
    (Number(formData.workingPattern.mon) || 0) +
    (Number(formData.workingPattern.tue) || 0) +
    (Number(formData.workingPattern.wed) || 0) +
    (Number(formData.workingPattern.thu) || 0) +
    (Number(formData.workingPattern.fri) || 0) +
    (Number(formData.workingPattern.sat) || 0) +
    (Number(formData.workingPattern.sun) || 0);

  const handleAddClosure = () => {
    if (!newClosureDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newClosureDate)) {
      toast.error("Please enter a valid date in YYYY-MM-DD format");
      return;
    }
    if (formData.factoryClosures.includes(newClosureDate)) {
      toast.error("Date already added to factory closures");
      return;
    }
    setFormData(prev => ({
      ...prev,
      factoryClosures: [...prev.factoryClosures, newClosureDate].sort(),
    }));
    setNewClosureDate("");
  };

  const handleRemoveClosure = (dateStr: string) => {
    setFormData(prev => ({
      ...prev,
      factoryClosures: prev.factoryClosures.filter(d => d !== dateStr),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await saveCapacitySettingsV2(formData);
      toast.success("V2 Capacity Settings updated successfully");
      onSettingsUpdated(formData);
      onClose();
    } catch (err: any) {
      console.error("Save error:", err);
      const msg = err.message || "Failed to save settings. Admin or Scheduler role required.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-brand/10 text-brand">
                <SlidersHorizontal className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Independent V2 Configuration
              </span>
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
              Workshop Capacity & Planning Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Changes apply strictly to the V2 forecasting engine. The original V1 Capacity & Risk page remains unaffected.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="p-3 my-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {errorMessage}
            </div>
          )}

          <div className="space-y-5 my-4">
            {/* Core Headcount & Efficiency */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800">
              {/* Headcount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-brand" />
                  Workshop Headcount
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.headcount}
                  onChange={(e) => setFormData({ ...formData, headcount: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-brand"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Authoritative manual input (default 22)</span>
              </div>

              {/* Efficiency */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-emerald-600" />
                  Efficiency Factor
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1.0"
                  value={formData.efficiency}
                  onChange={(e) => setFormData({ ...formData, efficiency: parseFloat(e.target.value) || 0.8 })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-brand"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Productive hours multiplier (80% default)</span>
              </div>

              {/* Risk Threshold */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Overload Threshold (%)
                </label>
                <input
                  type="number"
                  min="50"
                  max="200"
                  value={formData.riskThreshold}
                  onChange={(e) => setFormData({ ...formData, riskThreshold: parseInt(e.target.value, 10) || 90 })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-brand"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Triggers overload alert (default 90%)</span>
              </div>
            </div>

            {/* Standard Shift Pattern */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Chadwick Workshop Shift Pattern
                </label>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  Total: {weeklyHours}h / week per employee
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                Standard schedule is 10h Mon–Wed, 8h Thu, 0h Fri–Sun. NSW public holidays and factory closures automatically reduce working capacity on matching days.
              </p>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day) => (
                  <div key={day} className="text-center">
                    <span className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                      {day}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="14"
                      value={formData.workingPattern[day]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          workingPattern: {
                            ...formData.workingPattern,
                            [day]: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full text-center px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Actuals Factor Assumption */}
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-900 dark:text-white">
                    Actuals Factor (Operational Assumption)
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Adjusts recorded actual hours when subtracting from budget. Default is 0.70 for compatibility with V1. This is an operational assumption requiring ongoing verification.
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      step="0.05"
                      min="0.1"
                      max="1.5"
                      value={formData.actualsFactor}
                      onChange={(e) => setFormData({ ...formData, actualsFactor: parseFloat(e.target.value) || 0.7 })}
                      className="w-24 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                      required
                    />
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      Multiplier applied: {formData.actualsFactor}x
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Provisional Project Intake Rate Benchmark */}
            <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-900 dark:text-white">
                    Provisional Intake Benchmark (hrs/day per project)
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Controls estimated manufacturing duration when generating provisional planning windows backwards from delivery dates for unsequenced jobs. Benchmark default is 25 hrs/day (~2–3 concurrent technicians).
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      step="1"
                      min="5"
                      max="100"
                      value={formData.provisionalDailyHoursPerProject}
                      onChange={(e) => setFormData({ ...formData, provisionalDailyHoursPerProject: parseFloat(e.target.value) || 25 })}
                      className="w-24 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                      required
                    />
                    <span className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                      Estimated rate: {formData.provisionalDailyHoursPerProject} hrs / working shift
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Factory Closures */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-brand" />
                Configurable Factory Closures
              </label>
              <p className="text-[11px] text-slate-500 mb-3">
                NSW public holidays are automatically calculated. Add specific factory shutdown dates here when confirmed.
              </p>

              <div className="flex items-center gap-2 mb-3">
                <input
                  type="date"
                  value={newClosureDate}
                  onChange={(e) => setNewClosureDate(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddClosure}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-brand hover:bg-brand/90 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Date
                </button>
              </div>

              {formData.factoryClosures.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No custom factory closure dates configured.</div>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                  {formData.factoryClosures.map((dateStr) => (
                    <span
                      key={dateStr}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                    >
                      {dateStr}
                      <button
                        type="button"
                        onClick={() => handleRemoveClosure(dateStr)}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-brand hover:bg-brand/90 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save V2 Configuration"
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
