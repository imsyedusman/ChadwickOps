"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Plus, Download, Edit2, Check, X, AlertTriangle, Users, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { BlurredValue } from "@/components/ui/BlurredValue";
import { Tooltip } from "@/components/ui/Tooltip";
import { getWorkshopStaff, importWorkshopStaff, updateStaffMember, addStaffMemberManually } from "@/app/actions/workshop-staff";

interface WorkshopStaffSectionProps {
  isFinance: boolean;
}

export function WorkshopStaffSection({ isFinance }: WorkshopStaffSectionProps) {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAllRates, setShowAllRates] = useState(false);

  // Form states
  const [addForm, setAddForm] = useState({ fullName: "", isApprentice: false, hourlyRate: "" });
  const [editForm, setEditForm] = useState<any>({});

  const fetchStaff = async () => {
    try {
      const res = await getWorkshopStaff();
      if (res.success) {
        setStaffList(res.data);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load staff.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const res = await importWorkshopStaff();
      if (res.success) {
        toast.success(`Import complete — ${res.counts?.inserted || 0} inserted, ${res.counts?.updated || 0} updated, ${res.counts?.skipped || 0} skipped (rate override).`);
        await fetchStaff();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to import staff.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggle = async (id: number, field: string, value: boolean) => {
    try {
      setStaffList((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
      const res = await updateStaffMember(id, { [field]: value });
      if (res.success) {
        toast.success(`Updated successfully.`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update.");
      await fetchStaff(); // revert
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.fullName || !addForm.hourlyRate) {
      toast.error("Name and Hourly Rate are required.");
      return;
    }
    try {
      const res = await addStaffMemberManually(addForm as any);
      if (res.success) {
        toast.success("Staff member added successfully.");
        setIsAdding(false);
        setAddForm({ fullName: "", isApprentice: false, hourlyRate: "" });
        await fetchStaff();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add staff.");
    }
  };

  const startEditing = (staff: any) => {
    setEditingId(staff.id);
    setEditForm({ ...staff });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Clean up fields to only send what is allowed
      const { id, workguruId, createdAt, updatedAt, hourlyRateOverridden, ...dataToUpdate } = editForm;
      const res = await updateStaffMember(id, dataToUpdate);
      if (res.success) {
        toast.success("Staff member updated successfully.");
        setEditingId(null);
        await fetchStaff();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update staff.");
    }
  };

  const formatCurrency = (val: string | number) => {
    const num = Number(val);
    if (isNaN(num)) return "$0.00";
    return "$" + num.toFixed(2);
  };

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden mt-10">
      <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
            <Users className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Workshop Staff</h2>
        </div>
        <div className="flex items-center gap-3">
          {isFinance && (
            <button
              onClick={() => setShowAllRates(!showAllRates)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-sm"
            >
              {showAllRates ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showAllRates ? "Hide Rates" : "Show Rates"}
            </button>
          )}
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            {isAdding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isAdding ? "Cancel" : "Add Manually"}
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="flex items-center gap-2 bg-brand hover:bg-brand/90 text-white font-bold text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-md shadow-brand/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Import from WorkGuru
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Add Staff Member</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  value={addForm.fullName}
                  onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Hourly Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={addForm.hourlyRate}
                  onChange={(e) => setAddForm({ ...addForm, hourlyRate: e.target.value })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-brand text-white text-sm font-bold rounded-lg shadow hover:bg-brand/90"
              >
                Save Member
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto min-h-[300px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
              <p className="text-sm font-medium">Loading staff records...</p>
            </div>
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm italic">
            No workshop staff found. Import from WorkGuru or add manually.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hourly Rate</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Workshop Staff</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {staffList.map((staff) => (
                <React.Fragment key={staff.id}>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-8 py-4 text-sm font-bold text-slate-700 dark:text-slate-300">
                      {staff.fullName}
                    </td>
                    <td className="px-8 py-4">
                      <BlurredValue label="" canUnblur={isFinance} forceReveal={showAllRates}>
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(staff.hourlyRate)}
                        </span>
                      </BlurredValue>
                    </td>
                    <td className="px-8 py-4">
                      <Tooltip content="This person works on the factory floor and counts toward production capacity calculations">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={staff.isWorkshopStaff}
                            onChange={(e) => handleToggle(staff.id, "isWorkshopStaff", e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand/50 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-brand"></div>
                        </label>
                      </Tooltip>
                    </td>
                    <td className="px-8 py-4">
                      <Tooltip content="This person is currently employed. Inactive staff are excluded from capacity calculations">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={staff.isActive}
                            onChange={(e) => handleToggle(staff.id, "isActive", e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500"></div>
                        </label>
                      </Tooltip>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button
                        onClick={() => startEditing(staff)}
                        className="text-slate-400 hover:text-brand transition-colors p-1"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  
                  {/* Inline Edit Form */}
                  {editingId === staff.id && (
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <td colSpan={5} className="px-8 py-6">
                        <form onSubmit={handleEditSubmit} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name</label>
                              <input
                                type="text"
                                required
                                value={editForm.fullName || ""}
                                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hourly Rate ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={editForm.hourlyRate || ""}
                                onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                              />
                              {editForm.hourlyRate && editForm.hourlyRate.toString() !== staff.hourlyRate?.toString() && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium mt-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Manual override — this person's rate will no longer auto-update on import.
                                </p>
                              )}
                            </div>
                            <div className="space-y-4 flex flex-col justify-center pt-4">
                              <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editForm.isWorkshopStaff ?? true}
                                    onChange={(e) => setEditForm({ ...editForm, isWorkshopStaff: e.target.checked })}
                                    className="rounded border-slate-300 text-brand focus:ring-brand"
                                  />
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Workshop Staff</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editForm.isActive ?? true}
                                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                                    className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                  />
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Active</span>
                                </label>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Efficiency Ratings (0.00 - 1.00)</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {[
                                { key: "frameAssembly", label: "Frame Assembly" },
                                { key: "switchgearMount", label: "Switchgear Mount" },
                                { key: "busbar", label: "Busbar" },
                                { key: "wiring", label: "Wiring" },
                                { key: "labels", label: "Labels" },
                                { key: "testing", label: "Testing" },
                                { key: "packagingFreight", label: "Packaging and Freight" }
                              ].map((stage) => (
                                <div key={stage.key} className="space-y-1">
                                  <label className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{stage.label}</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="1"
                                    placeholder="e.g. 0.85"
                                    value={editForm[stage.key] || ""}
                                    onChange={(e) => setEditForm({ ...editForm, [stage.key]: e.target.value === "" ? null : e.target.value })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end gap-3 pt-4">
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-bold rounded-lg shadow hover:bg-brand/90"
                            >
                              <Check className="h-4 w-4" />
                              Save Changes
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
