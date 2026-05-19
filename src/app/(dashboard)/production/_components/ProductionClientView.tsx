'use client';

import { useMemo } from 'react';
import { CapacitySettings } from '@/actions/capacity';
import { 
  format, 
  startOfToday, 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  differenceInDays,
  isBefore,
  isAfter,
  parseISO,
  addDays
} from 'date-fns';
import { Clock, Users, Activity, Lightbulb, CalendarDays, AlertTriangle, Play, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isProductiveProject, INTERNAL_WORK_DESCRIPTION } from '@/lib/project-utils';
import { Tooltip } from '@/components/ui/Tooltip';

interface Project {
  id: number;
  workguruId: string;
  projectNumber: string;
  name: string;
  budgetHours: number;
  actualHours: number;
  remainingHours: number;
  deliveryDate: Date | null;
  projectManager: string | null;
  rawStatus: string;
  client: { name: string } | null;
}

interface ProductionClientViewProps {
  initialSettings: CapacitySettings;
  activeProjects: Project[];
}

const formatHours = (value: number) => {
    return new Intl.NumberFormat('en-AU').format(Math.round(value)) + 'h';
};

export default function ProductionClientView({ initialSettings, activeProjects }: ProductionClientViewProps) {
    const today = startOfToday();
    
    // Group Projects
    const groupedProjects = useMemo(() => {
        const buckets = {
            overdue: [] as Project[],
            thisWeek: [] as Project[],
            next2Weeks: [] as Project[],
            future: [] as Project[],
            unscheduled: [] as Project[]
        };

        const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
        const twoWeeksEnd = addWeeks(weekEnd, 2);

        activeProjects.forEach(p => {
            if (!p.deliveryDate) {
                buckets.unscheduled.push(p);
                return;
            }

            const dDate = new Date(p.deliveryDate);
            
            if (isBefore(dDate, today)) { // strictly < today
                buckets.overdue.push(p);
            } else if (isBefore(dDate, weekStart)) { // Missed this week start but not today? Unlikely if using startOfToday
                buckets.overdue.push(p);
            } else if (!isAfter(dDate, weekEnd)) {
                buckets.thisWeek.push(p);
            } else if (!isAfter(dDate, twoWeeksEnd)) {
                buckets.next2Weeks.push(p);
            } else {
                buckets.future.push(p);
            }
        });

        // Sort each bucket: Primary: Due Date ASC (put oldest first), Secondary: Remaining Hours DESC
        const sortFn = (a: Project, b: Project) => {
            if (!a.deliveryDate && !b.deliveryDate) return b.remainingHours - a.remainingHours;
            if (!a.deliveryDate) return 1;
            if (!b.deliveryDate) return -1;
            
            const dateDiff = new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
            if (dateDiff === 0) {
                return b.remainingHours - a.remainingHours;
            }
            return dateDiff;
        };

        buckets.overdue.sort(sortFn);
        buckets.thisWeek.sort(sortFn);
        buckets.next2Weeks.sort(sortFn);
        buckets.future.sort(sortFn);
        buckets.unscheduled.sort(sortFn);

        return buckets;
    }, [activeProjects, today]);

    // Shop Load Analysis (Next 8 Weeks)
    const HORIZON_WEEKS = 8;
    const weeklyLoad = useMemo(() => {
        const weeks = [];
        const currentCapacity = initialSettings.staff * initialSettings.hoursPerWeek * initialSettings.efficiency;
        let runningStart = startOfWeek(today, { weekStartsOn: 1 });

        for (let i = 0; i < HORIZON_WEEKS; i++) {
            const wStart = runningStart;
            const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
            
            // Demand: projects due in this week - Productive Only
            const projectsInWeek = activeProjects.filter(p => {
                if (!p.deliveryDate || !isProductiveProject(p.projectNumber)) return false;
                const dDate = new Date(p.deliveryDate);
                return (isAfter(dDate, wStart) || dDate.getTime() === wStart.getTime()) 
                       && (isBefore(dDate, wEnd) || dDate.getTime() === wEnd.getTime());
            });

            const demand = projectsInWeek.reduce((acc, p) => acc + p.remainingHours, 0);
            
            weeks.push({
                weekStart: wStart,
                weekEnd: wEnd,
                demand,
                capacity: currentCapacity,
                available: currentCapacity - demand,
                projectsCount: projectsInWeek.length,
                projects: projectsInWeek
            });

            runningStart = addWeeks(runningStart, 1);
        }
        return weeks;
    }, [activeProjects, initialSettings, today]);

    return (
        <div className="space-y-8">
            {/* Top Analysis Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Shop Load Analysis */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-200/60 dark:border-slate-800/60 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                <Activity className="h-4 w-4 text-emerald-500" />
                                Shop Load Analysis
                            </h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                                <Lightbulb className="h-3 w-3 text-amber-500" />
                                Demand based on delivery week. Future iterations may distribute remaining hours across weeks.
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-1 p-0">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-700/60 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                                <tr>
                                    <th className="px-5 py-3">Week Of</th>
                                    <th className="px-4 py-3 text-center">Projects</th>
                                    <th className="px-5 py-3 text-right">Demand</th>
                                    <th className="px-5 py-3 text-right">Capacity</th>
                                    <th className="px-5 py-3 text-right">Available</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {weeklyLoad.map((w, i) => {
                                    const isCurrentWeek = i === 0;
                                    const isOverloaded = w.available < 0;
                                    const isAtRisk = w.available >= 0 && w.available <= w.capacity * 0.1;
                                    
                                    return (
                                        <tr key={i} className={cn("hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors", isCurrentWeek ? "bg-slate-50/80 dark:bg-slate-800/40" : "")}>
                                            <td className="px-5 py-3">
                                                <div className="flex gap-2 items-center">
                                                    <span className={cn("font-bold text-sm", isCurrentWeek ? "text-brand" : "text-slate-900 dark:text-white")}>
                                                        {format(w.weekStart, 'MMM d')} - {format(w.weekEnd, 'MMM d')}
                                                    </span>
                                                    {isCurrentWeek && <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase text-brand bg-brand/10 tracking-widest">Current</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center text-xs font-bold text-slate-500">{w.projectsCount}</td>
                                            <td className="px-5 py-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">{formatHours(w.demand)}</td>
                                            <td className="px-5 py-3 text-right font-bold text-slate-500 tabular-nums">{formatHours(w.capacity)}</td>
                                            <td className={cn(
                                                "px-5 py-3 text-right font-black tabular-nums text-base",
                                                isOverloaded ? "text-red-500" : isAtRisk ? "text-orange-500" : "text-emerald-500"
                                            )}>
                                                {formatHours(w.available)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Timeline Visualization */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-5 border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                             <CalendarDays className="h-4 w-4 text-indigo-500" />
                             Delivery Density
                        </h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1"># Projects due per week</p>
                    </div>
                    <div className="p-5 flex-1 flex items-end gap-2 overflow-x-auto custom-scrollbar">
                        {weeklyLoad.map((w, i) => {
                            const maxProjects = Math.max(...weeklyLoad.map(wl => wl.projectsCount), 1);
                            const heightPercent = (w.projectsCount / maxProjects) * 100;
                            const isOverloaded = w.available < 0;
                            
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-2 min-w-[32px] group relative">
                                    <span className="text-[10px] font-bold text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4">{w.projectsCount}</span>
                                    <div 
                                        className={cn(
                                            "w-full rounded-sm transition-all duration-500",
                                            isOverloaded ? "bg-red-500/80" : "bg-indigo-400/80 dark:bg-indigo-500/80",
                                            w.projectsCount === 0 ? "h-1 bg-slate-100 dark:bg-slate-800" : "hover:brightness-110"
                                        )}
                                        style={{ height: w.projectsCount > 0 ? `${Math.max(10, heightPercent)}%` : '4px' }}
                                    />
                                    <span className="text-[9px] font-bold text-slate-500 rotate-[-45deg] origin-top-left -ml-2 mt-2">{format(w.weekStart, 'MMM d')}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Execution View: Time Buckets */}
            <div className="space-y-6">
                <BucketSection title="Overdue" projects={groupedProjects.overdue} type="overdue" today={today} />
                <BucketSection title="Due This Week" projects={groupedProjects.thisWeek} type="soon" today={today} />
                <BucketSection title="Due Next 2 Weeks" projects={groupedProjects.next2Weeks} type="upcoming" today={today} />
                <BucketSection title="Future" projects={groupedProjects.future} type="normal" today={today} />
                <BucketSection title="Unscheduled" projects={groupedProjects.unscheduled} type="unscheduled" today={today} />
            </div>
        </div>
    );
}

function BucketSection({ title, projects, type, today }: { title: string, projects: Project[], type: 'overdue'|'soon'|'upcoming'|'normal'|'unscheduled', today: Date }) {
    if (projects.length === 0) return null;

    const getHeaderStyles = () => {
        if (type === 'overdue') return "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20";
        if (type === 'soon') return "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20";
        if (type === 'upcoming') return "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20";
        if (type === 'unscheduled') return "text-slate-500 bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700";
        return "text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800/60";
    };

    return (
        <div className="block">
            <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-t-xl border-t border-l border-r border-b-0 font-bold text-sm tracking-wide uppercase shadow-sm relative z-10", getHeaderStyles())}>
                {type === 'overdue' && <AlertTriangle className="h-4 w-4" />}
                {type === 'soon' && <Play className="h-4 w-4" />}
                {type === 'unscheduled' && <Calendar className="h-4 w-4" />}
                {title}
                <span className="ml-2 px-2 py-0.5 rounded-md bg-white/50 dark:bg-black/20 text-xs">{projects.length}</span>
            </div>
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl rounded-tl-none overflow-hidden shadow-sm relative -mt-[1px] z-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-700/60 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                            <tr>
                                <th className="px-4 py-3 w-10"></th>
                                <th className="px-4 py-3">Project</th>
                                <th className="px-4 py-3 font-semibold">Client</th>
                                <th className="px-4 py-3 font-semibold">PM</th>
                                <th className="px-4 py-3">Due Date</th>
                                <th className="px-4 py-3 text-right">Remaining Hrs</th>
                                <th className="px-4 py-3 w-48">Progress</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {projects.map((p) => {
                                const percent = p.budgetHours > 0 ? (p.actualHours / p.budgetHours) * 100 : 0;
                                const displayPercent = Math.min(100, Math.max(0, percent));
                                
                                const isOverdue = p.deliveryDate && isBefore(new Date(p.deliveryDate), today);
                                const isDueSoon = p.deliveryDate && isBefore(new Date(p.deliveryDate), addDays(today, 14)) && !isOverdue;
                                const isHighPercent = percent >= 80 && p.rawStatus !== 'Completed';
                                
                                const daysRemaining = p.deliveryDate ? differenceInDays(new Date(p.deliveryDate), today) : null;

                                return (
                                    <tr 
                                      key={p.id} 
                                      className={cn(
                                        "hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group",
                                        !isProductiveProject(p.projectNumber) && "opacity-60 grayscale-[0.3]"
                                      )}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1.5 flex-col items-start w-10">
                                                {!isProductiveProject(p.projectNumber) && (
                                                  <Tooltip content={INTERNAL_WORK_DESCRIPTION}>
                                                    <span className="w-2 h-2 rounded-full bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.6)]" title="Internal" />
                                                  </Tooltip>
                                                )}
                                                {isProductiveProject(p.projectNumber) && isOverdue && <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" title="Overdue" />}
                                                {isProductiveProject(p.projectNumber) && isDueSoon && <span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]" title="Due Soon" />}
                                                {isProductiveProject(p.projectNumber) && isHighPercent && <span className="w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.6)]" title="High Usage >= 80%" />}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-bold text-xs text-slate-500">{p.projectNumber}</span>
                                                  {!isProductiveProject(p.projectNumber) && (
                                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 uppercase tracking-tighter">Internal</span>
                                                  )}
                                                </div>
                                                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[250px]">{p.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{p.client?.name || 'Unknown'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-bold text-slate-500">{p.projectManager || 'Unassigned'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {p.deliveryDate ? (
                                                <div className="flex flex-col gap-0.5 items-start">
                                                    <span className={cn(
                                                        "text-sm font-bold",
                                                        isOverdue ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"
                                                    )}>
                                                        {format(new Date(p.deliveryDate), 'MMM d, yyyy')}
                                                    </span>
                                                    {daysRemaining !== null && (
                                                        <span className={cn(
                                                            "text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm",
                                                            daysRemaining < 0 ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" :
                                                            daysRemaining <= 14 ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" :
                                                            "text-slate-400"
                                                        )}>
                                                            {daysRemaining < 0 ? `${Math.abs(daysRemaining)} days late` :
                                                             daysRemaining === 0 ? 'Due today' : `${daysRemaining} days left`}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs font-medium italic text-slate-400">None set</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-base font-black tabular-nums text-slate-800 dark:text-slate-200">{formatHours(p.remainingHours)}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-2 flex bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner isolate">
                                                    <div 
                                                        className={cn(
                                                            "h-full transition-all duration-700 ease-out",
                                                            isHighPercent ? "bg-amber-400" : "bg-emerald-400"
                                                        )} 
                                                        style={{ width: `${displayPercent}%` }}
                                                    />
                                                </div>
                                                <span className={cn(
                                                    "text-[10px] font-bold w-10 text-right tabular-nums",
                                                    isHighPercent ? "text-amber-500" : "text-slate-500"
                                                )}>
                                                    {Math.round(percent)}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
