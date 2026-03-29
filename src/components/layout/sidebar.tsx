"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-provider";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";
import { 
  LayoutDashboard, 
  CalendarDays, 
  BarChart3, 
  Settings, 
  History,
  Activity,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";

const navigation = [
  { name: 'WIP Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Production Plan', href: '/production', icon: CalendarDays },
  { name: 'Capacity & Risk', href: '/risk', icon: BarChart3 },
  { name: 'Sync Logs', href: '/logs', icon: History },
];

const secondaryNavigation = [
  { name: 'Admin Panel', href: '/admin', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggle } = useSidebar();
  const { preferences } = useUserPreferences();

  return (
    <div className={cn(
      "flex flex-col h-screen font-sans bg-slate-50 dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800/60 transition-[width] duration-200 ease-in-out overflow-hidden z-30",
      isCollapsed ? "w-[var(--sidebar-width-compact)]" : "w-[var(--sidebar-width-expanded)]"
    )}>
      {/* Sidebar Header / Logo */}
      <div className="h-16 flex items-center px-4 border-b border-transparent">
        <div className={cn(
          "flex items-center transition-all duration-300",
          isCollapsed ? "justify-center w-full px-0" : "px-2"
        )}>
          <div className={cn(
            "relative transition-all duration-500 ease-in-out",
            isCollapsed ? "h-8 w-8 min-w-[32px]" : "h-11 w-44"
          )}>
            <Image 
              src="/logo.svg" 
              alt="Logo" 
              fill 
              className="object-contain dark:brightness-110"
              priority
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-grow py-6 overflow-y-auto no-scrollbar">
        <div className="px-3 mb-6">
           {!isCollapsed && (
             <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-3 mb-3 animate-in fade-in duration-500">
               Platform
             </p>
           )}
           <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <SidebarLink 
                  key={item.name} 
                  item={item} 
                  isActive={isActive} 
                  isCollapsed={isCollapsed} 
                />
              );
            })}
          </nav>
        </div>

        <div className="px-3 mt-auto pt-6 border-t border-slate-200/40 dark:border-slate-800/40">
           {!isCollapsed && (
             <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-3 mb-3 animate-in fade-in duration-500">
               Management
             </p>
           )}
           <nav className="space-y-1">
            {secondaryNavigation.map((item) => {
              // Only show Admin Panel if user is admin
              if (item.name === 'Admin Panel' && !preferences.isAdmin) return null;
              
              const isActive = pathname === item.href;
              return (
                <SidebarLink 
                  key={item.name} 
                  item={item} 
                  isActive={isActive} 
                  isCollapsed={isCollapsed} 
                />
              );
            })}
          </nav>
        </div>
      </div>
      
      {/* Sidebar Footer / Toggle */}
      <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-100/30 dark:bg-slate-900/50">
        <button
          onClick={toggle}
          className={cn(
            "flex items-center w-full p-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all duration-200 group relative",
            isCollapsed ? "justify-center" : "gap-3"
          )}
        >
          {isCollapsed ? (
            <>
              <PanelLeftOpen className="h-5 w-5" />
              <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                 EXPAND
              </div>
            </>
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-widest truncate">Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SidebarLink({ item, isActive, isCollapsed }: any) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center p-2.5 text-sm font-semibold rounded-xl transition-all duration-200 relative",
        isActive 
          ? "bg-white dark:bg-slate-800 text-brand shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50" 
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200",
        isCollapsed ? "justify-center" : "gap-3"
      )}
    >
      <item.icon
        className={cn(
          "flex-shrink-0 h-5 w-5 transition-colors",
          isActive ? "text-brand" : "text-slate-400 group-hover:text-slate-500"
        )}
      />
      {!isCollapsed && (
        <span className="truncate animate-in slide-in-from-left-2 duration-300">
          {item.name}
        </span>
      )}
      
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl border border-white/10 translate-x-1 group-hover:translate-x-0">
           {item.name}
           {/* Tooltip Arrow */}
           <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45 border-l border-b border-white/5" />
        </div>
      )}

      {!isCollapsed && isActive && (
        <div className="absolute right-3 h-1.5 w-1.5 rounded-full bg-brand animate-in fade-in zoom-in duration-500" />
      )}
    </Link>
  );
}
