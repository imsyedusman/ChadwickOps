"use client";

import * as React from "react";
import { format, setMonth, setYear } from "date-fns";
import { Calendar as CalendarIcon, X, ChevronDown } from "lucide-react";
import { DayPicker, DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import "react-day-picker/dist/style.css";

interface DateRangePickerProps {
  label: string;
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  className?: string;
}

export function DateRangePicker({
  label,
  startDate,
  endDate,
  onRangeChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [month, setMonthState] = React.useState<Date>(
    startDate ? new Date(startDate) : new Date()
  );
  const containerRef = React.useRef<HTMLDivElement>(null);

  const range: DateRange | undefined = React.useMemo(() => {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    if (!start && !end) return undefined;
    return { from: start, to: end };
  }, [startDate, endDate]);

  const handleSelect = (newRange: DateRange | undefined) => {
    if (!newRange) {
      onRangeChange("", "");
      return;
    }
    const startStr = newRange.from ? format(newRange.from, "yyyy-MM-dd") : "";
    const endStr = newRange.to ? format(newRange.to, "yyyy-MM-dd") : "";
    onRangeChange(startStr, endStr);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRangeChange("", "");
  };

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayDate = React.useMemo(() => {
    if (!startDate && !endDate) return label;
    const start = startDate ? format(new Date(startDate), "dd.MM.yyyy") : "...";
    const end = endDate ? format(new Date(endDate), "dd.MM.yyyy") : "...";
    return `${start} - ${end}`;
  }, [startDate, endDate, label]);

  const years = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;
    const endYear = currentYear + 10;
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  }, []);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between gap-3 bg-white dark:bg-slate-950 border rounded-xl px-3 py-2 transition-all min-w-[220px]",
          (startDate || endDate)
            ? "border-blue-600 ring-4 ring-blue-600/5 bg-blue-50/10"
            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <CalendarIcon className={cn("h-4 w-4 shrink-0", (startDate || endDate) ? "text-blue-600" : "text-slate-400")} />
          <span className={cn(
            "text-[10px] font-bold truncate",
            (startDate || endDate) ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"
          )}>
            {displayDate}
          </span>
        </div>
        {(startDate || endDate) && (
          <X 
            className="h-3 w-3 text-slate-400 hover:text-red-500 transition-colors" 
            onClick={handleClear}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-center gap-2 mb-4 px-2">
            <div className="relative group">
              <select
                value={month.getMonth()}
                onChange={(e) => setMonthState(setMonth(month, parseInt(e.target.value)))}
                className="appearance-none bg-transparent pl-2 pr-6 py-1 text-[13px] font-bold text-slate-900 dark:text-slate-100 outline-none cursor-pointer hover:text-blue-600 transition-colors"
              >
                {months.map((m, i) => (
                  <option key={m} value={i} className="bg-white dark:bg-slate-900">{m}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none group-hover:text-blue-600 transition-colors" />
            </div>
            <div className="relative group">
              <select
                value={month.getFullYear()}
                onChange={(e) => setMonthState(setYear(month, parseInt(e.target.value)))}
                className="appearance-none bg-transparent pl-2 pr-6 py-1 text-[13px] font-bold text-slate-900 dark:text-slate-100 outline-none cursor-pointer hover:text-blue-600 transition-colors"
              >
                {years.map((y) => (
                  <option key={y} value={y} className="bg-white dark:bg-slate-900">{y}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none group-hover:text-blue-600 transition-colors" />
            </div>
          </div>

          <style>{`
            .rdp {
              --rdp-cell-size: 38px;
              --rdp-accent-color: #0055ff;
              --rdp-background-color: #e6f0ff;
              --rdp-accent-color-dark: #0066ff;
              --rdp-background-color-dark: #0f172a;
              margin: 0;
            }
            .rdp-caption {
              display: none; /* Hide default caption since we have custom dropdowns */
            }
            .rdp-head_cell {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              color: #94a3b8;
              padding-bottom: 12px;
            }
            .rdp-day {
              font-size: 13px;
              font-weight: 600;
              color: #1e293b;
              border-radius: 10px;
              transition: all 0.2s;
            }
            .dark .rdp-day {
              color: #f1f5f9;
            }
            .rdp-day_selected:not(.rdp-day_range_middle) {
              background-color: var(--rdp-accent-color) !important;
              color: white !important;
              border-radius: 10px;
            }
            .rdp-day_range_middle {
              background-color: var(--rdp-background-color) !important;
              color: var(--rdp-accent-color) !important;
              border-radius: 0;
            }
            .dark .rdp-day_range_middle {
              background-color: var(--rdp-background-color-dark) !important;
              color: #60a5fa !important;
            }
            .rdp-day_range_start {
              border-top-right-radius: 0;
              border-bottom-right-radius: 0;
            }
            .rdp-day_range_end {
              border-top-left-radius: 0;
              border-bottom-left-radius: 0;
            }
            .rdp-day:hover:not(.rdp-day_selected) {
              background-color: #f1f5f9;
            }
            .dark .rdp-day:hover:not(.rdp-day_selected) {
              background-color: #1e293b;
            }
            .rdp-button:focus-visible {
              outline: 2px solid var(--rdp-accent-color);
            }
          `}</style>
          <DayPicker
            mode="range"
            month={month}
            onMonthChange={setMonthState}
            selected={range}
            onSelect={handleSelect}
            numberOfMonths={1}
            className="border-none"
          />
        </div>
      )}
    </div>
  );
}
