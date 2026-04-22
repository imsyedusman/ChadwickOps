"use client";

import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format, subMonths, addMonths } from "date-fns";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  currentDate: Date;
  onChange: (date: Date) => void;
}

export function MonthPicker({ currentDate, onChange }: MonthPickerProps) {
  const handlePrev = () => onChange(subMonths(currentDate, 1));
  const handleNext = () => onChange(addMonths(currentDate, 1));
  const handleCurrent = () => onChange(new Date());

  return (
    <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
      <div className="flex items-center gap-1">
        <button
          onClick={handlePrev}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          title="Previous Month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        
        <div className="px-4 py-1.5 flex flex-col items-center min-w-[140px]">
          <span className="text-[10px] font-bold text-brand uppercase tracking-[0.2em] leading-none mb-1">
            Reporting Period
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
            {format(currentDate, "MMMM yyyy")}
          </span>
        </div>

        <button
          onClick={handleNext}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          title="Next Month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="h-8 w-px bg-slate-200/60 dark:border-slate-800/60" />

      <button
        onClick={handleCurrent}
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all",
          format(currentDate, "yyyy-MM") === format(new Date(), "yyyy-MM")
            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default"
            : "text-slate-600 hover:text-brand hover:bg-brand/5 dark:text-slate-400 dark:hover:text-brand dark:hover:bg-brand/10"
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        Current
      </button>
    </div>
  );
}
