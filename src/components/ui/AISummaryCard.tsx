"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface AISummaryCardProps {
  summary: string | null;
  loading: boolean;
  compact?: boolean;
}

export function AISummaryCard({ summary, loading, compact = false }: AISummaryCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!loading && !summary) {
    return null;
  }

  return (
    <div className={cn(
      "bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-100 dark:border-blue-900 shadow-sm animate-in fade-in zoom-in-95 duration-300 overflow-hidden",
      !compact && "mb-4"
    )}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors focus:outline-none",
          compact ? "p-2" : "p-3"
        )}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className={cn("text-blue-500", compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
          <span className={cn(
            "font-bold text-blue-700/80 dark:text-blue-300/80 uppercase tracking-widest",
            compact ? "text-[10px]" : "text-xs"
          )}>
            AI Summary
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-blue-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-blue-400" />
        )}
      </button>

      {isOpen && (
        <div className={cn("px-3 pb-3", compact ? "pt-0 pb-2 px-2" : "pt-1")}>
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-3 bg-blue-200/50 dark:bg-blue-800/50 rounded w-full"></div>
              <div className="h-3 bg-blue-200/50 dark:bg-blue-800/50 rounded w-4/5"></div>
            </div>
          ) : (
            <p className={cn(
              "text-blue-900 dark:text-blue-100 font-medium leading-relaxed",
              compact ? "text-[14px]" : "text-sm"
            )}>
              {summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
