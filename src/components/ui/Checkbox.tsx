"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
}

export function Checkbox({ checked, onChange, className }: CheckboxProps) {
  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
      className={cn(
        "h-4 w-4 rounded border transition-all duration-200 flex items-center justify-center cursor-pointer",
        checked 
          ? "bg-brand border-brand text-white shadow-sm" 
          : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800",
        className
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={4} />}
    </div>
  );
}
