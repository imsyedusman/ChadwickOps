"use client";

import { cn } from "@/lib/utils";
import { 
  RefreshCw, 
  Search, 
  User, 
  Sun, 
  Moon, 
  Bell,
  Command
} from "lucide-react";
import React, { useState, useEffect, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { SyncIndicator } from "@/components/dashboard/SyncIndicator";

export function Header() {
  const { theme, setTheme } = useTheme();
  // Avoid hydration mismatch
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  return (
    <header className="h-16 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-20 transition-all duration-300 w-full">
      <div className="flex items-center gap-6 flex-1 max-w-2xl">
         <div className="relative w-full group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
              <Search className="h-4 w-4 text-slate-400 group-focus-within:text-brand transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="Search anything..." 
              className="w-full pl-11 pr-12 py-2.5 bg-slate-100/50 dark:bg-slate-800/40 border border-transparent focus:border-brand/20 dark:focus:border-brand/30 rounded-2xl text-[13px] font-medium focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-brand/5 outline-none transition-all placeholder:text-slate-400"
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] text-slate-400 font-bold opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none shadow-sm">
               <Command className="h-2.5 w-2.5" /> K
            </div>
         </div>
      </div>
      
      <div className="flex items-center gap-6 ml-6">
        <SyncIndicator />

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
          >
            {mounted && (theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />)}
          </button>

          <button className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-all relative border border-transparent">
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-brand border-2 border-white dark:border-slate-900" />
          </button>
        </div>

        <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:ring-4 hover:ring-brand/10 hover:border-brand/30 transition-all ml-1 overflow-hidden group">
          <User className="h-5 w-5 text-slate-400 group-hover:text-brand transition-colors" />
        </div>
      </div>
    </header>
  );
}

function Button({ className, variant, size, ...props }: unknown) {
  const variants: unknown = {
    outline: "border border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100",
    ghost: "hover:bg-slate-100 dark:hover:bg-slate-800",
  };
  const sizes: unknown = {
    sm: "px-3 py-1.5 text-xs",
    icon: "p-2",
  };
  return (
    <button 
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-all active:scale-[0.98] disabled:opacity-50", 
        variants[variant || "outline"],
        sizes[size || "sm"],
        className
      )} 
      {...props} 
    />
  );
}
