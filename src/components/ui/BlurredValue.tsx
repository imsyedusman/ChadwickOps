"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface BlurredValueProps {
  label: string;
  canUnblur?: boolean;
  children: React.ReactNode;
}

export function BlurredValue({ label, canUnblur = false, children }: BlurredValueProps) {
  const [isBlurred, setIsBlurred] = useState(true);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}:</span>
      <div className="flex items-center gap-2">
        <span className={isBlurred ? "filter blur-sm select-none transition-all duration-300" : "transition-all duration-300"}>
          {children}
        </span>
        {canUnblur && (
          <button
            type="button"
            onClick={() => setIsBlurred(!isBlurred)}
            className="text-slate-400 hover:text-brand transition-colors p-1 cursor-pointer"
            title={isBlurred ? "Show Value" : "Hide Value"}
          >
            {isBlurred ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
