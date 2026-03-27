"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  CalendarDays, 
  BarChart3, 
  Settings, 
  History,
  Activity
} from "lucide-react";

const navigation = [
  { name: 'WIP Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Production Plan', href: '/production', icon: CalendarDays },
  { name: 'Capacity & Risk', href: '/risk', icon: BarChart3 },
  { name: 'Sync Logs', href: '/logs', icon: History },
  { name: 'Admin Panel', href: '/admin', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-slate-900 text-white">
      <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4 mb-8">
          <Activity className="h-8 w-8 text-brand mr-2" />
          <span className="text-xl font-bold tracking-tight">WorkGuru Ops</span>
        </div>
        <nav className="mt-2 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive 
                    ? "bg-slate-800 text-brand font-semibold border-l-4 border-brand" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                  "group flex items-center px-4 py-3 text-sm transition-all duration-200"
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? "text-brand" : "text-slate-400 group-hover:text-slate-300",
                    "mr-3 flex-shrink-0 h-5 w-5"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex-shrink-0 flex bg-slate-800 p-4">
        <div className="flex-shrink-0 w-full group block">
          <div className="flex items-center">
            <div className="ml-3">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Environment</p>
              <p className="text-sm font-medium text-white">Local Development</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
