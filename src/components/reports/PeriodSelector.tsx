"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ChevronDown, 
  Calendar, 
  Clock, 
  Check 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReportingPreset } from "@/lib/reports";

const PRESETS: { label: string; value: ReportingPreset; description: string }[] = [
  { label: "This Month", value: "this_month", description: "Current billing cycle in Sydney" },
  { label: "Last Month", value: "last_month", description: "Full previous calendar month" },
  { label: "Last 3 Months", value: "last_3_months", description: "Rolling 90-day window" },
  { label: "Last 6 Months", value: "last_6_months", description: "Rolling 180-day window" },
  { label: "Year to Date", value: "ytd", description: "From Jan 1st to today" },
];

interface PeriodSelectorProps {
  currentPreset: string;
}

export function PeriodSelector({ currentPreset }: PeriodSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (preset: ReportingPreset) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("p", preset);
      router.push(`/reports?${params.toString()}`);
    });
  };

  const activePreset = PRESETS.find(p => p.value === currentPreset) || PRESETS[0];

  return (
    <div className="relative group">
      <div className={cn(
        "flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm transition-all hover:border-brand/40",
        isPending && "opacity-50 pointer-events-none"
      )}>
        <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <Calendar className="h-4 w-4 text-slate-500" />
        </div>
        
        <div className="flex flex-col min-w-[140px]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">
            Reporting Window
          </span>
          <div className="flex items-center justify-between group/selector cursor-pointer">
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {activePreset.label}
            </span>
            <ChevronDown className="h-3 w-3 ml-2 text-slate-400 group-hover/selector:text-brand transition-colors" />
          </div>
        </div>

        {/* Dropdown Menu (using standard peer/checkbox or hover for simplicity, or just absolute) */}
        <div className="absolute top-full left-0 mt-2 w-64 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-1 group-hover:translate-y-0">
          <div className="space-y-1">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => handleSelect(p.value)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left group/item",
                  p.value === currentPreset 
                    ? "bg-brand/5 text-brand" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                <div>
                  <p className="text-xs font-bold leading-none mb-1">{p.label}</p>
                  <p className="text-[10px] opacity-70 font-medium">{p.description}</p>
                </div>
                {p.value === currentPreset && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
