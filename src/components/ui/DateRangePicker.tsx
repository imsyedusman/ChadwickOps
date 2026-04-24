"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
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

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between gap-3 bg-white dark:bg-slate-950 border rounded-xl px-3 py-2 transition-all min-w-[220px]",
          (startDate || endDate)
            ? "border-brand ring-2 ring-brand/5 bg-brand/[0.02]"
            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <CalendarIcon className={cn("h-4 w-4 shrink-0", (startDate || endDate) ? "text-brand" : "text-slate-400")} />
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
        <div className="absolute left-0 mt-2 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
          <style>{`
            .rdp {
              --rdp-cell-size: 36px;
              --rdp-accent-color: var(--color-brand, #3b82f6);
              --rdp-background-color: color-mix(in srgb, var(--color-brand, #3b82f6) 10%, transparent);
              --rdp-accent-color-dark: var(--color-brand, #3b82f6);
              --rdp-background-color-dark: color-mix(in srgb, var(--color-brand, #3b82f6) 20%, transparent);
              --rdp-outline: 2px solid var(--rdp-accent-color);
              --rdp-outline-selected: 2px solid var(--rdp-accent-color);
              margin: 0;
            }
            .rdp-day_selected, .rdp-day_selected:focus-visible, .rdp-day_selected:hover {
              background-color: var(--rdp-accent-color);
              color: white;
            }
            .rdp-day_range_middle {
              background-color: var(--rdp-background-color);
              color: var(--rdp-accent-color);
            }
            .dark .rdp-day_range_middle {
              background-color: var(--rdp-background-color-dark);
              color: white;
            }
            .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
              background-color: #f1f5f9;
            }
            .dark .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
              background-color: #1e293b;
            }
            .rdp-head_cell {
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              color: #94a3b8;
              padding-bottom: 8px;
            }
            .rdp-caption_label {
              font-size: 13px;
              font-weight: 700;
              color: #1e293b;
            }
            .dark .rdp-caption_label {
              color: #f1f5f9;
            }
            .rdp-nav_button {
              color: #94a3b8;
            }
          `}</style>
          <DayPicker
            mode="range"
            defaultMonth={range?.from}
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
