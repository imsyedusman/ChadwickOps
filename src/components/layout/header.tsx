"use client";

import { cn } from "@/lib/utils";
import { triggerSync } from "@/app/actions/sync";
import { RefreshCw, Search, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner"; // Assuming I'll add sonner later

export function Header() {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await triggerSync();
      if (result.success) {
        alert("Sync completed successfully!"); // Fallback until sonner is added
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      alert("An unexpected error occurred during sync.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-4 flex-1">
         <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search projects, clients..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none transition-all"
            />
         </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleSync}
          disabled={isSyncing}
          className="gap-2 border-slate-200 text-slate-600 hover:text-brand hover:border-brand transition-colors"
        >
          <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing..." : "Sync Now"}
        </Button>
        <div className="h-8 w-px bg-slate-200" />
        <Button variant="ghost" size="icon" className="text-slate-600">
          <User className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

// Minimal Button component if shadcn is not fully ready
function Button({ className, variant, size, ...props }: any) {
  const variants: any = {
    outline: "border border-slate-200 bg-transparent hover:bg-slate-100",
    ghost: "hover:bg-slate-100",
  };
  const sizes: any = {
    sm: "px-3 py-1.5 text-xs",
    icon: "p-2",
  };
  return (
    <button 
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50", 
        variants[variant || "outline"],
        sizes[size || "sm"],
        className
      )} 
      {...props} 
    />
  );
}
