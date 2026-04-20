'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { CapacitySettings, updateCapacitySettings } from '@/actions/capacity';
import { format, addMonths, startOfMonth, parseISO } from 'date-fns';
import { AlertTriangle, TrendingDown, TrendingUp, Users, Activity, Save, Loader2, Info, Lightbulb, PieChart, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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
}

interface CapacityClientViewProps {
  initialSettings: CapacitySettings;
  activeProjects: Project[];
  initialHorizon: number; // Ignored for Phase 4 since we track local state
}

const formatHours = (value: number) => {
    return new Intl.NumberFormat('en-AU').format(Math.round(value)) + 'h';
};

type TimeRangeType = '3' | '6' | '12' | 'custom';

export default function CapacityClientView({ initialSettings, activeProjects }: CapacityClientViewProps) {
  const [settings, setSettings] = useState<CapacitySettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  
  const [timeRange, setTimeRange] = useState<TimeRangeType>('6');
  const [customStart, setCustomStart] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [customEnd, setCustomEnd] = useState<string>(format(addMonths(new Date(), 5), 'yyyy-MM'));
  
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateCapacitySettings(settings);
      toast.success('Capacity settings updated');
    } catch (e: unknown) {
      toast.error(e.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const currentCapacity = settings.staff * settings.hoursPerWeek * settings.weeksPerMonth * settings.efficiency;

  // Generate continuous months based on selector
  const months = useMemo(() => {
    const list = [];
    if (timeRange === 'custom') {
       let curr = parseISO(`${customStart}-01`);
       const end = parseISO(`${customEnd}-01`);
       // Guard against infinite loop if invalid
       let count = 0;
       while (curr <= end && count < 60) {
          list.push(format(curr, 'yyyy-MM'));
          curr = addMonths(curr, 1);
          count++;
       }
       if (list.length === 0) list.push(format(new Date(), 'yyyy-MM')); // Fallback
    } else {
       const horizon = parseInt(timeRange);
       const now = startOfMonth(new Date());
       for (let i = 0; i < horizon; i++) {
          list.push(format(addMonths(now, i), 'yyyy-MM'));
       }
    }
    return list;
  }, [timeRange, customStart, customEnd]);

  useEffect(() => {
    if (!selectedMonth || !months.includes(selectedMonth)) {
       const timeout = setTimeout(() => {
         setSelectedMonth(months[0] || null);
       }, 0);
       return () => clearTimeout(timeout);
    }
  }, [months, selectedMonth]);

  // Aggregate Data
  const monthlyData = useMemo(() => {
    const data: Record<string, { budget: number; actual: number; remaining: number; internalRemaining: number; projects: Project[] }> = {};
    months.forEach(m => data[m] = { budget: 0, actual: 0, remaining: 0, internalRemaining: 0, projects: [] });

    activeProjects.forEach(p => {
        if (!p.deliveryDate) return; 
        const m = format(new Date(p.deliveryDate), 'yyyy-MM');
        if (data[m]) {
            if (isProductiveProject(p.projectNumber)) {
                data[m].budget += p.budgetHours;
                data[m].actual += p.actualHours;
                data[m].remaining += p.remainingHours;
            } else {
                data[m].internalRemaining += p.remainingHours;
            }
            data[m].projects.push(p);
        }
    });

    return data;
  }, [activeProjects, months]);

  // Summary Metrics
  const totalCapacity = currentCapacity * months.length;
  const totalPlanned = months.reduce((acc, m) => acc + monthlyData[m].remaining, 0);
  const netAvailable = totalCapacity - totalPlanned;
  const overloadedMonthsCount = months.filter(m => currentCapacity - monthlyData[m].remaining < 0).length;

  // Intelligent Insight - Productive Only
  const insightText = useMemo(() => {
      const overloaded = months.find(m => currentCapacity - monthlyData[m].remaining < 0);
      if (overloaded) {
          const topReqs = [...monthlyData[overloaded].projects]
                .filter(p => isProductiveProject(p.projectNumber))
                .sort((a,b) => b.remainingHours - a.remainingHours)
                .slice(0, 2);
          const names = topReqs.map(p => `"${p.name}"`).join(' and ');
          return `${format(parseISO(`${overloaded}-01`), 'MMMM')} is overloaded, primarily driven by ${names || 'multiple smaller projects'}.`;
      }
      
      const atRisk = months.find(m => (currentCapacity - monthlyData[m].remaining) <= currentCapacity * 0.1);
      if (atRisk) {
          return `Capacity tightens in ${format(parseISO(`${atRisk}-01`), 'MMMM')}. Consider spacing out deliverables.`;
      }

      return `Forward capacity is healthy with ample buffer across the next ${months.length} months.`;
  }, [months, monthlyData, currentCapacity]);

  // PM Load Breakdown - Split
  const pmLoad = useMemo(() => {
    const load: Record<string, { productive: number; internal: number }> = {};
    months.forEach(m => {
        monthlyData[m].projects.forEach(p => {
            const pm = p.projectManager || 'Unassigned';
            if (!load[pm]) load[pm] = { productive: 0, internal: 0 };
            
            if (isProductiveProject(p.projectNumber)) {
                load[pm].productive += p.remainingHours;
            } else {
                load[pm].internal += p.remainingHours;
            }
        });
    });
    
    return Object.entries(load)
      .sort((a, b) => (b[1].productive + b[1].internal) - (a[1].productive + a[1].internal)) // Sort by total load
      .filter(([_, stats]) => (stats.productive + stats.internal) > 0);
  }, [monthlyData, months]);

  return (
    <div className="space-y-6">
      {/* Dynamic Time Selector & Insight */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
         <div className="flex items-center gap-3">
             <div className="flex p-1 bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-800/50">
                 {['3', '6', '12', 'custom'].map((tr) => (
                    <button 
                       key={tr}
                       onClick={() => setTimeRange(tr as TimeRangeType)}
                       className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all capitalize", timeRange === tr ? "bg-slate-900 text-white dark:bg-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
                    >
                        {tr === 'custom' ? 'Custom' : `${tr} Mo`}
                    </button>
                 ))}
             </div>
             {timeRange === 'custom' && (
                 <div className="flex items-center gap-2">
                     <input type="month" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1" />
                     <span className="text-xs text-slate-400">to</span>
                     <input type="month" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1" />
                 </div>
             )}
         </div>

         {/* Simple Insight */}
         <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300">
             <Lightbulb className="h-4 w-4 shrink-0" />
             <p className="text-xs font-semibold">{insightText}</p>
         </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Demand" value={formatHours(totalPlanned)} subtitle={`${months.length} mo horizon`} icon={<PieChart />} />
          <SummaryCard title="Total Capacity" value={formatHours(totalCapacity)} subtitle={`Team of ${settings.staff}`} icon={<Users />} />
          <SummaryCard title="Net Available" value={formatHours(netAvailable)} subtitle="Capacity - Demand" highlight={netAvailable < 0 ? 'red' : 'green'} icon={<Layers />} />
          <SummaryCard title="Risk Periods" value={overloadedMonthsCount} suffix="mos" subtitle="Overloaded months" highlight={overloadedMonthsCount > 0 ? 'orange' : 'neutral'} icon={<AlertTriangle />} />
      </div>

      {/* Main Grid: Data & Sidebars */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

          {/* Table & Drivers (Left 9 columns) */}
          <div className="xl:col-span-9 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-700/60 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                              <tr>
                                  <th className="px-5 py-3">Month</th>
                                  <th className="px-5 py-3 text-right">
                                    <Tooltip content="Total estimated hours from all project tasks in WorkGuru.">
                                      <span className="cursor-help border-b border-dotted border-slate-300">Budget</span>
                                    </Tooltip>
                                  </th>
                                  <th className="px-5 py-3 text-right">
                                    <Tooltip content="Total hours logged in WorkGuru timesheets as of the last sync.">
                                      <span className="cursor-help border-b border-dotted border-slate-300">Actual</span>
                                    </Tooltip>
                                  </th>
                                  <th className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">
                                    <Tooltip content="Outstanding work (Budget minus Actual). Calculated for active projects only.">
                                      <span className="cursor-help border-b border-dotted border-slate-300">Remaining</span>
                                    </Tooltip>
                                  </th>
                                  <th className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">
                                    <Tooltip content="Capacity minus Remaining work. Shows how much more work the workshop can take on.">
                                      <span className="cursor-help border-b border-dotted border-slate-300">Available</span>
                                    </Tooltip>
                                  </th>
                                  <th className="px-5 py-3 w-[25%] text-left">
                                    <Tooltip content="Workload vs. available capacity. Higher % means higher risk of delays.">
                                      <span className="cursor-help border-b border-dotted border-slate-300">Capacity Utilization</span>
                                    </Tooltip>
                                  </th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                              {months.map(m => {
                                  const d = monthlyData[m];
                                  const planned = d.remaining;
                                  const internal = d.internalRemaining;
                                  const available = currentCapacity - planned;
                                  const percent = currentCapacity > 0 ? (planned / currentCapacity) * 100 : 0;
                                  
                                  const isSelected = selectedMonth === m;
                                  const isOverloaded = available < 0;
                                  const isAtRisk = available >= 0 && available <= currentCapacity * 0.1;
 
                                  const rowClass = cn(
                                      "transition-all cursor-pointer group",
                                      isSelected ? "bg-slate-50 dark:bg-slate-800/80 ring-1 ring-inset ring-slate-200 dark:ring-slate-700" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
                                      isOverloaded && !isSelected ? "bg-red-50/30 dark:bg-red-900/10" : "",
                                      isAtRisk && !isSelected ? "bg-orange-50/30 dark:bg-orange-900/10" : ""
                                  );
 
                                  return (
                                      <React.Fragment key={m}>
                                      <tr className={rowClass} onClick={() => setSelectedMonth(m)}>
                                          <td className="px-5 py-4 whitespace-nowrap">
                                              <span className={cn(
                                                  "font-bold text-sm",
                                                  isSelected ? "text-brand" : "text-slate-900 dark:text-white"
                                              )}>
                                                  {format(parseISO(`${m}-01`), 'MMM yyyy')}
                                              </span>
                                          </td>
                                          <td className="px-5 py-4 text-right text-xs text-slate-400 tabular-nums">{formatHours(d.budget)}</td>
                                          <td className="px-5 py-4 text-right text-xs text-slate-400 tabular-nums">{formatHours(d.actual)}</td>
                                          
                                          {/* Emphasized Fields */}
                                          <td className="px-5 py-4 text-right font-bold text-slate-900 dark:text-white tabular-nums text-base">{formatHours(planned)}</td>
                                          <td className={cn(
                                              "px-5 py-4 text-right font-bold tabular-nums text-base relative group/row-info",
                                              isOverloaded ? "text-red-500" : isAtRisk ? "text-orange-500" : "text-emerald-600 dark:text-emerald-400"
                                          )}>
                                              {formatHours(available)}
                                          </td>
 
                                          {/* Visual Risk Bar */}
                                          <td className="px-5 py-4">
                                              <div className="flex items-center gap-3">
                                                  <div className="flex-1 h-3 flex bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner isolate">
                                                      <div 
                                                          className={cn(
                                                              "h-full transition-all duration-700 ease-out",
                                                              isOverloaded ? "bg-red-500" : isAtRisk ? "bg-orange-400" : "bg-emerald-400"
                                                          )} 
                                                          style={{ width: `${Math.min(100, percent)}%` }} 
                                                      />
                                                  </div>
                                                  <span className={cn(
                                                      "text-[10px] font-bold w-10 text-right tabular-nums",
                                                      isOverloaded ? "text-red-600 dark:text-red-400" : "text-slate-500"
                                                  )}>
                                                      {Math.round(percent)}%
                                                  </span>
                                              </div>
                                          </td>
                                      </tr>
                                      {/* Internal Load Sub-row (Muted) */}
                                      {internal > 0 && (
                                        <tr className="bg-slate-50/30 dark:bg-slate-800/20 border-b border-slate-100/50 dark:border-slate-800/50">
                                            <td className="px-5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-8">
                                                Internal Load
                                            </td>
                                            <td colSpan={2}></td>
                                            <td className="px-5 py-1.5 text-right font-bold text-slate-400 tabular-nums text-xs">
                                                +{formatHours(internal)}
                                            </td>
                                            <td colSpan={2} className="px-5 py-1.5 text-[9px] text-slate-400 italic">
                                                Excluded from capacity utilization
                                            </td>
                                        </tr>
                                      )}
                                      </React.Fragment>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* Dynamic Top Drivers */}
              {selectedMonth && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 shadow-sm animate-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center justify-between mb-6">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                             <TrendingUp className="h-4 w-4 text-brand" />
                             Top Drivers • {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
                          </h3>
                          <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md">
                              Total Demand: {formatHours(monthlyData[selectedMonth].remaining)}
                          </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           {monthlyData[selectedMonth].projects.length > 0 ? (
                               [...monthlyData[selectedMonth].projects]
                                 .filter(p => isProductiveProject(p.projectNumber))
                                 .sort((a,b) => b.remainingHours - a.remainingHours)
                                 .slice(0, 3)
                                 .map((p, i) => {
                                     const totalProductive = monthlyData[selectedMonth].remaining;
                                     const percentOfTotal = totalProductive > 0 
                                       ? (p.remainingHours / totalProductive) * 100 
                                       : 0;
                                    
                                    return (
                                        <div key={p.id} className="relative p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 rounded-xl group hover:border-brand/30 transition-colors">
                                           <div className="absolute top-0 right-0 p-3 opacity-10 font-black text-4xl italic -mt-2 -mr-1">#{i+1}</div>
                                           <p className="font-bold text-xs text-slate-500 mb-1">{p.projectNumber}</p>
                                           <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 mb-3" title={p.name}>{p.name}</p>
                                           
                                           <div className="flex justify-between items-end">
                                               <div>
                                                   <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Remaining</p>
                                                   <p className="font-black text-xl tabular-nums text-slate-700 dark:text-slate-200">{formatHours(p.remainingHours)}</p>
                                               </div>
                                               <div className="text-right">
                                                   <span className="text-xs font-bold text-brand bg-brand/10 px-2 py-1 rounded-md">{percentOfTotal.toFixed(1)}%</span>
                                               </div>
                                           </div>
                                        </div>
                                    );
                                })
                          ) : (
                              <div className="col-span-3 py-8 text-center bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                  <p className="text-sm font-medium text-slate-400">No project demand scheduled for this month.</p>
                              </div>
                          )}
                      </div>
                  </div>
              )}
          </div>

          {/* Right Sidebar (Settings + PM Load) */}
          <div className="xl:col-span-3 space-y-6">
              
              {/* Settings Core */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                      <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                          <SettingsIcon className="h-4 w-4 text-slate-400" />
                          Capacity Factors
                      </h2>
                      <button 
                          onClick={handleSave}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-focus text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all"
                      >
                          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          Save
                      </button>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                          <SettingField label="Staff" value={settings.staff} onChange={(v) => setSettings({...settings, staff: v})} step={0.5} min={1} />
                          <SettingField label="Hrs/Wk" value={settings.hoursPerWeek} onChange={(v) => setSettings({...settings, hoursPerWeek: v})} step={1} min={1} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <SettingField label="Efficiency" value={settings.efficiency} onChange={(v) => setSettings({...settings, efficiency: v})} step={0.05} min={0} max={1} />
                          <SettingField label="Wks/Mo" value={settings.weeksPerMonth} onChange={(v) => setSettings({...settings, weeksPerMonth: v})} step={0.01} min={1} />
                      </div>
                  </div>
              </div>

              {/* PM Load Panel */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm p-5 flex flex-col h-[500px]">
                  <div className="flex items-center justify-between gap-2 mb-2">
                      <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                          <Activity className="h-4 w-4 text-indigo-500" />
                          PM Load
                      </h2>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{months.length} mo</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-6">Aggregate % of total planned workload.</p>                   <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                       {pmLoad.length > 0 ? pmLoad.map(([pm, stats], i) => {
                           const totalHours = stats.productive + stats.internal;
                           const productivePercent = (stats.productive / totalPlanned) * 100;
                           const isTop = i < 2; // Highlight top 2
                           
                           return (
                               <div key={pm} className="space-y-1.5 group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                   <div className="flex justify-between items-start text-xs font-bold">
                                       <span className={cn(
                                           "truncate pr-4 flex items-center gap-2",
                                           isTop ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"
                                       )}>
                                           {isTop && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
                                           {pm}
                                       </span>
                                       <div className="text-right flex flex-col items-end">
                                           <div className="flex items-center gap-1.5">
                                               <span className="text-slate-900 dark:text-white tabular-nums">{formatHours(stats.productive)}</span>
                                               <span className="text-[9px] text-slate-400 font-medium">productive</span>
                                           </div>
                                           {stats.internal > 0 && (
                                               <div className="flex items-center gap-1.5 opacity-60">
                                                   <span className="text-slate-500 tabular-nums">{formatHours(stats.internal)}</span>
                                                   <span className="text-[9px] text-slate-400 font-medium italic">internal</span>
                                               </div>
                                           )}
                                       </div>
                                   </div>
                                   <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                                       <div 
                                           className={cn(
                                               "h-full transition-all duration-1000",
                                               isTop ? "bg-brand" : "bg-indigo-400"
                                           )}
                                           style={{ width: `${(stats.productive / totalHours) * 100}%` }}
                                       />
                                       <div 
                                           className="h-full bg-slate-300 dark:bg-slate-700 transition-all duration-1000 opacity-50"
                                           style={{ width: `${(stats.internal / totalHours) * 100}%` }}
                                       />
                                   </div>
                                   <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 px-0.5">
                                      <span>{Math.round(productivePercent)}% of total shop load</span>
                                      {stats.internal > 0 && <span>+{formatHours(stats.internal)} internal</span>}
                                   </div>
                               </div>
                           );
                       }) : (
                           <div className="flex items-center justify-center h-full text-xs font-medium text-slate-400 italic">No PM data available.</div>
                       )}
                   </div>
              </div>
          </div>
      </div>
    </div>
  );
}

// Icon component
function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
}

function SettingField({ label, value, onChange, min, max, step }: { label: string, value: number, onChange: (v: number) => void, min?: number, max?: number, step?: number }) {
    return (
        <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
            <input 
              type="number" 
              min={min} max={max} step={step}
              value={value || ''}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono focus:ring-1 focus:ring-brand focus:border-brand transition-all"
            />
        </div>
    );
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  subtitle: string;
  highlight?: 'red' | 'green' | 'orange' | 'neutral';
  icon?: React.ReactNode;
}

function SummaryCard({ title, value, suffix, subtitle, highlight, icon }: SummaryCardProps) {
    return (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 p-6 opacity-[0.03] dark:opacity-5 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                <div className="w-24 h-24">{icon}</div>
            </div>
            <div className="flex justify-between items-start mb-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</h3>
                <div className={cn(
                    "p-1.5 rounded-lg border shadow-sm",
                    highlight === 'red' ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-500" :
                    highlight === 'green' ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-500" :
                    highlight === 'orange' ? "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-orange-500" :
                    "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
                )}>
                    {icon && <div className="[&>svg]:h-4 [&>svg]:w-4">{icon}</div>}
                </div>
            </div>
            <div className="space-y-1">
                <div className="flex items-baseline gap-1.5">
                    <span className={cn(
                        "text-3xl font-black tabular-nums tracking-tight",
                        highlight === 'red' ? "text-red-500" :
                        highlight === 'green' ? "text-emerald-500" :
                        "text-slate-900 dark:text-white"
                    )}>{value}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{subtitle}</p>
            </div>
        </div>
    );
}
