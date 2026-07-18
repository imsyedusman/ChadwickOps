"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Users, UserMinus, Settings2 } from "lucide-react";

export function SettingsLayout({
  workshopStaff,
  staffAbsences,
  capacitySettings
}: {
  workshopStaff: React.ReactNode;
  staffAbsences: React.ReactNode;
  capacitySettings: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState("staff");

  const nav = [
    { id: "staff", label: "Workshop Staff", icon: Users },
    { id: "absences", label: "Staff Absences", icon: UserMinus },
    { id: "capacity", label: "Capacity Settings", icon: Settings2 },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="w-full md:w-64 shrink-0">
        <nav className="flex flex-col space-y-1">
          {nav.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "group flex items-center p-2.5 text-sm font-semibold rounded-xl transition-all duration-200 text-left",
                  isActive 
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                <item.icon
                  className={cn(
                    "flex-shrink-0 h-5 w-5 mr-3 transition-colors",
                    isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-slate-500"
                  )}
                />
                {item.label}
                {isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-in fade-in zoom-in duration-500" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 min-w-0">
        <div className={cn("transition-opacity duration-300", activeTab === "staff" ? "opacity-100 block" : "opacity-0 hidden")}>
          {workshopStaff}
        </div>
        <div className={cn("transition-opacity duration-300", activeTab === "absences" ? "opacity-100 block" : "opacity-0 hidden")}>
          {staffAbsences}
        </div>
        <div className={cn("transition-opacity duration-300", activeTab === "capacity" ? "opacity-100 block" : "opacity-0 hidden")}>
          {capacitySettings}
        </div>
      </div>
    </div>
  );
}
