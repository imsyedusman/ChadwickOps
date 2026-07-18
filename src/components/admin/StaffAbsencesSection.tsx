"use client";

import { useState, useEffect, useMemo } from "react";
import { getWorkshopStaff, getStaffAbsences, addStaffAbsence, deleteStaffAbsence } from "@/app/actions/workshop-staff";
import { toast } from "sonner";
import { format, isBefore, startOfToday } from "date-fns";
import { Trash2, Plus, CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StaffAbsencesSection() {
  const [staff, setStaff] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [staffId, setStaffId] = useState("");
  const [openStaff, setOpenStaff] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const staffRes = await getWorkshopStaff();
      if (staffRes.success && staffRes.data) {
        setStaff(staffRes.data.filter((s: any) => s.isActive && s.isWorkshopStaff));
      }
      
      const absRes = await getStaffAbsences();
      if (absRes.success && absRes.data) {
        setAbsences(absRes.data);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId || !startDate || !endDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    try {
      const res = await addStaffAbsence(Number(staffId), new Date(startDate), new Date(endDate), reason);
      if (res.success) {
        toast.success("Absence added successfully.");
        setStaffId("");
        setStartDate("");
        setEndDate("");
        setReason("");
        loadData();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to add absence.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this absence?")) return;
    try {
      const res = await deleteStaffAbsence(id);
      if (res.success) {
        toast.success("Absence deleted successfully.");
        loadData();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to delete absence.");
    }
  };

  const today = startOfToday();

  const sortedAbsences = useMemo(() => {
    const sorted = [...absences].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const upcoming = sorted.filter((abs) => !isBefore(new Date(abs.endDate), today));
    const past = sorted.filter((abs) => isBefore(new Date(abs.endDate), today)).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()); // past descending
    return [...upcoming, ...past];
  }, [absences, today]);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-visible p-8">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-2">Staff Absences</h2>
      <p className="text-sm text-slate-500 mb-6">Manage upcoming absences and leave for workshop staff.</p>

      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-8 border border-slate-200/60 dark:border-slate-800/60">
        <h3 className="text-sm font-semibold mb-3">Add Absence</h3>
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Staff Member</label>
            <Popover open={openStaff} onOpenChange={setOpenStaff}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openStaff}
                  className="w-full justify-between bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-[38px] font-normal"
                >
                  {staffId
                    ? staff.find((s) => s.id.toString() === staffId)?.fullName
                    : "Select Staff..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0 z-[100]" align="start">
                <Command>
                  <CommandInput placeholder="Search staff..." />
                  <CommandList>
                    <CommandEmpty>No staff found.</CommandEmpty>
                    <CommandGroup>
                      {staff.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={s.fullName}
                          onSelect={() => {
                            setStaffId(s.id.toString());
                            setOpenStaff(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              staffId === s.id.toString() ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            {s.fullName}
                            {s.isApprentice && <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded ml-2">Apprentice</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date Range</label>
            <DateRangePicker
              label="Select dates"
              startDate={startDate}
              endDate={endDate}
              onRangeChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Reason (Optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Annual Leave"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm h-[38px]"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 h-[38px]"
          >
            <Plus className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-4 py-3 font-medium">Staff Name</th>
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium">To</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading...</td>
              </tr>
            ) : sortedAbsences.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No absences found.</td>
              </tr>
            ) : (
              sortedAbsences.map((abs) => {
                const isPast = isBefore(new Date(abs.endDate), today);
                return (
                  <tr key={abs.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isPast ? "opacity-50 grayscale bg-slate-50/50 dark:bg-slate-900/50" : ""}`}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{abs.staffName}</td>
                    <td className="px-4 py-3">{format(new Date(abs.startDate), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3">{format(new Date(abs.endDate), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3 text-slate-500">{abs.reason || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(abs.id)}
                        className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        title="Delete absence"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
