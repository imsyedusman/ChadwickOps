"use client";

import React, { useEffect, useRef } from "react";
import Gantt from "frappe-gantt";
import "./gantt-overrides.css";
import { ProjectSchedulingData, resetScheduledStart } from "@/app/actions/production-scheduling";
import { format, addDays, startOfDay } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export interface GanttProject extends ProjectSchedulingData {
  isBlocked?: boolean;
  blockReasons?: string[];
}

interface GanttChartProps {
  projects: GanttProject[];
  viewMode: "Day" | "Week" | "Month" | "Year";
  canDrag?: boolean;
  onDateChange?: (projectId: string, start: Date) => void;
  onClick?: (task: any) => void;
}

const DIMMED_STATUSES = ["On Hold", "2.5 - Tested Passed", "Tested Passed"];

const formatStatusLabel = (status: string | null) => {
  if (!status) return "Unknown";
  const parts = status.split(" - ");
  return parts.length > 1 ? parts.slice(1).join(" - ").trim() : status.trim();
};

const getBadgeColor = (status: string | null) => {
  if (status && ["2.2 - In Progress", "In Progress", "Waiting to Start"].includes(status)) {
    return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800";
  }
  if (status && ["1.3 - Drawings Approved", "2.1 - Sheetmetal and switchgear ordrered"].includes(status)) {
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
  }
  if (status && ["2.3 - Ready for Testing", "2.4 - Tested Defective"].includes(status)) {
    return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800";
  }
  return "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
};

export function GanttChart({ projects, viewMode, canDrag = false, onDateChange, onClick }: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<Gantt | null>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const ganttWrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Sync scroll positions between Gantt and left panel
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (leftPanelRef.current) {
      leftPanelRef.current.scrollTop = scrollTop;
    }
    
    // Fake sticky for the SVG grid header
    const svgHeader = ganttWrapperRef.current?.querySelector('.gantt .grid-header') as SVGGElement | null;
    if (svgHeader) {
      svgHeader.style.transform = `translateY(${scrollTop}px)`;
    }
  };

  useEffect(() => {
    const wrapper = ganttWrapperRef.current;
    if (!wrapper) return;

    const handleWheel = (e: WheelEvent) => {
      // Allow horizontal scrolling if shift key is held or it's a touchpad horizontal swipe
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      e.preventDefault();
      e.stopPropagation();
      wrapper.scrollTop += e.deltaY;
    };

    wrapper.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => wrapper.removeEventListener("wheel", handleWheel, { capture: true });
  }, []);

  useEffect(() => {
    const handleGanttClick = async (e: Event) => {
      const target = e.target as HTMLElement | SVGElement;
      
      // Today button
      if (target.tagName === 'BUTTON' && target.textContent?.trim().toLowerCase() === 'today') {
        e.preventDefault();
        e.stopPropagation();
        const highlight = ganttWrapperRef.current?.querySelector('.gantt .today-highlight') as SVGRectElement | null;
        if (highlight && ganttWrapperRef.current) {
          const x = parseFloat(highlight.getAttribute('x') || '0');
          const containerWidth = ganttWrapperRef.current.clientWidth;
          ganttWrapperRef.current.scrollLeft = Math.max(0, x - containerWidth / 2);
        }
        return;
      }

      // Reset button
      if (canDrag && (target.classList?.contains('reset-btn') || target.closest?.('.reset-btn'))) {
        e.preventDefault();
        e.stopPropagation();
        const wrapper = target.closest?.('.bar-wrapper') || (target.classList?.contains('bar-wrapper') ? target : null);
        const taskIdStr = wrapper?.getAttribute('data-id');
        if (taskIdStr) {
          const toastId = toast.loading("Clearing schedule...");
          try {
            const res = await resetScheduledStart(parseInt(taskIdStr, 10));
            if (res.success) {
              toast.success("Schedule cleared", { id: toastId });
              router.refresh();
            } else {
              toast.error(res.error || "Failed to clear schedule", { id: toastId });
            }
          } catch (err) {
            toast.error("Failed to clear schedule", { id: toastId });
          }
        }
      }
    };

    const container = document.querySelector('.frappe-gantt-container');
    if (container) {
      container.addEventListener('click', handleGanttClick, true);
      return () => container.removeEventListener('click', handleGanttClick, true);
    }
  }, [projects, canDrag, router]);

  // Effect 1: Inject Dependency Indicators (runs for all users)
  useEffect(() => {
    if (!ganttWrapperRef.current) return;

    const injectDependencyIndicators = () => {
      const wrappers = ganttWrapperRef.current?.querySelectorAll('.bar-wrapper');
      wrappers?.forEach(wrapper => {
        const taskIdStr = wrapper.getAttribute('data-id');
        if (!taskIdStr) return;
        const project = projects.find(p => p.id.toString() === taskIdStr);

        if (project?.isBlocked) {
          let lockGroup = wrapper.querySelector('.lock-indicator');
          if (!lockGroup) {
            lockGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            lockGroup.setAttribute('class', 'lock-indicator ignore-mutate');
            
            const lockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            lockSvg.setAttribute('d', 'M10 8V6c0-1.66-1.34-3-3-3S4 4.34 4 6v2H2.5v7h11V8H10zM5.5 6c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v2h-3V6z');
            lockSvg.setAttribute('fill', '#ffffff');
            lockSvg.setAttribute('class', 'lock-icon');
            lockSvg.setAttribute('transform', 'translate(6, 3) scale(0.9)');

            const tooltipGroup = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
            tooltipGroup.setAttribute('width', '250');
            tooltipGroup.setAttribute('height', '100');
            tooltipGroup.setAttribute('class', 'lock-tooltip-container');
            tooltipGroup.setAttribute('x', '0');
            tooltipGroup.setAttribute('y', '20');

            const tooltipDiv = document.createElement('div');
            tooltipDiv.className = 'lock-tooltip';
            tooltipDiv.innerHTML = project.blockReasons?.join('<br/>') || '';
            
            tooltipGroup.appendChild(tooltipDiv);
            lockGroup.appendChild(lockSvg);
            lockGroup.appendChild(tooltipGroup);
            wrapper.appendChild(lockGroup);
          }
        }
      });
    };

    const observer = new MutationObserver((mutations) => {
      let shouldInject = false;
      for (const m of mutations) {
        if (m.type === 'childList') {
          shouldInject = true; break;
        }
        if (m.type === 'attributes' && (m.target as Element).classList?.contains('bar')) {
          shouldInject = true; break;
        }
      }
      if (shouldInject) {
        injectDependencyIndicators();
      }
    });

    observer.observe(ganttWrapperRef.current, { 
      childList: true, 
      subtree: true, 
      attributes: true, 
      attributeFilter: ['width', 'x'] 
    });
    
    setTimeout(injectDependencyIndicators, 100);

    return () => observer.disconnect();
  }, [projects, viewMode]);

  // Effect 2: Inject Reset Buttons (runs only when canDrag is true)
  useEffect(() => {
    if (!canDrag || !ganttWrapperRef.current) return;

    const injectResetButtons = () => {
      const wrappers = ganttWrapperRef.current?.querySelectorAll('.bar-wrapper');
      
      wrappers?.forEach(wrapper => {
        const bar = wrapper.querySelector('.bar');
        if (!bar) return;
        const width = parseFloat(bar.getAttribute('width') || '0');
        const height = parseFloat(bar.getAttribute('height') || '0');
        
        let btn = wrapper.querySelector('.reset-btn');
        if (!btn) {
          // Create SVG button
          btn = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          btn.setAttribute('class', 'reset-btn ignore-mutate');
          (btn as SVGElement).style.cursor = 'pointer';
          
          const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bg.setAttribute('class', 'reset-bg');
          bg.setAttribute('width', '24');
          bg.setAttribute('height', '24');
          bg.setAttribute('rx', '4');
          bg.setAttribute('fill', 'rgba(255,255,255,0.9)');
          
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.textContent = '✕';
          text.setAttribute('class', 'reset-text');
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('dominant-baseline', 'central');
          text.setAttribute('fill', '#ef4444');
          text.setAttribute('font-size', '14');
          text.setAttribute('font-weight', 'bold');
          
          btn.appendChild(bg);
          btn.appendChild(text);
          wrapper.appendChild(btn);
        }
        
        // Update positions
        if (btn) {
          const bg = btn.querySelector('.reset-bg');
          const text = btn.querySelector('.reset-text');
          if (bg && text) {
            bg.setAttribute('x', (width - 28).toString());
            bg.setAttribute('y', ((height - 24) / 2).toString());
            text.setAttribute('x', (width - 16).toString());
            text.setAttribute('y', (height / 2).toString());
          }
        }
      });
    };

    const observer = new MutationObserver((mutations) => {
      let shouldInject = false;
      for (const m of mutations) {
        if (m.type === 'childList') {
          shouldInject = true; break;
        }
        if (m.type === 'attributes' && (m.target as Element).classList?.contains('bar')) {
          shouldInject = true; break;
        }
      }
      if (shouldInject) {
        injectResetButtons();
      }
    });

    observer.observe(ganttWrapperRef.current, { 
      childList: true, 
      subtree: true, 
      attributes: true, 
      attributeFilter: ['width', 'x'] 
    });
    
    // Attempt initial injection
    setTimeout(injectResetButtons, 100);

    return () => observer.disconnect();
  }, [projects, canDrag, viewMode]);

  // Effect 3: Format Week Labels (runs for all users)
  useEffect(() => {
    if (viewMode !== "Week" || !ganttWrapperRef.current) return;

    const fixWeekLabels = () => {
      const labels = ganttWrapperRef.current?.querySelectorAll('.gantt .grid-header .lower-text');
      if (!labels || labels.length === 0) return;

      let currentMonth = "";
      
      labels.forEach(label => {
        const text = label.textContent || "";
        if (text.includes(' - ')) {
          const parts = text.split(' - ');
          if (parts.length !== 2) return;
          
          const startStr = parts[0].trim();
          const endStr = parts[1].trim();

          const startHasLetters = /[a-zA-Z]/.test(startStr);
          const endHasLetters = /[a-zA-Z]/.test(endStr);

          let startDay = startStr.replace(/[a-zA-Z]/g, '').trim().padStart(2, '0');
          let endDay = endStr.replace(/[a-zA-Z]/g, '').trim().padStart(2, '0');
          
          let startMonth = currentMonth;
          let endMonth = currentMonth;

          if (startHasLetters) {
            startMonth = startStr.match(/[a-zA-Z]+/)?.[0] || startMonth;
            currentMonth = startMonth;
          }
          
          if (endHasLetters) {
            endMonth = endStr.match(/[a-zA-Z]+/)?.[0] || endMonth;
            currentMonth = endMonth; 
          } else {
            endMonth = startMonth;
          }
          
          if (!startMonth) {
            const firstUpper = ganttWrapperRef.current?.querySelector('.gantt .grid-header .upper-text');
            startMonth = firstUpper?.textContent?.split(' ')[0].substring(0, 3) || "Jan";
            currentMonth = startMonth;
            endMonth = startMonth;
          }

          const newText = `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
          if (label.textContent !== newText) {
            label.textContent = newText;
          }
        }
      });
    };

    const observer = new MutationObserver((mutations) => {
      let shouldInject = false;
      for (const m of mutations) {
        if (m.type === 'childList') {
          shouldInject = true; break;
        }
      }
      if (shouldInject) {
        fixWeekLabels();
      }
    });

    observer.observe(ganttWrapperRef.current, { 
      childList: true, 
      subtree: true
    });
    
    setTimeout(fixWeekLabels, 100);

    return () => observer.disconnect();
  }, [projects, viewMode]);

  useEffect(() => {
    if (!containerRef.current) {
      ganttRef.current = null;
      return;
    }

    // Transform projects into frappe-gantt tasks
    const tasks = projects.map((p) => {
      const start = p.scheduledStart ? new Date(p.scheduledStart) : new Date();
      
      // Fix 1: Minimum duration of 5 days
      const remainingDays = Math.max(5, Math.ceil((p.remainingHours || 0) / 8));
      const end = addDays(start, remainingDays - 1);

      const isDimmed = p.rawStatus && DIMMED_STATUSES.includes(p.rawStatus);
      const isUnscheduled = !p.scheduledStart;

      // Fix 2: Custom class for unscheduled. Frappe Gantt does classList.add(custom_class)
      // which fails if there are spaces. Provide a single combined class if both apply.
      let baseColor = "";
      if (p.rawStatus) {
        if (["2.2 - In Progress", "In Progress", "Waiting to Start"].includes(p.rawStatus)) {
          baseColor = "blue";
        } else if (["1.3 - Drawings Approved", "2.1 - Sheetmetal and switchgear ordrered"].includes(p.rawStatus)) {
          baseColor = "amber";
        } else if (["2.3 - Ready for Testing", "2.4 - Tested Defective"].includes(p.rawStatus)) {
          baseColor = "purple";
        }
      }

      let custom_class = "";
      if (isDimmed && isUnscheduled) {
        custom_class = baseColor ? `gantt-dimmed-unscheduled-${baseColor}` : "gantt-dimmed-unscheduled";
      } else if (isDimmed) {
        custom_class = baseColor ? `gantt-dimmed-${baseColor}` : "gantt-dimmed";
      } else if (isUnscheduled) {
        custom_class = baseColor ? `gantt-unscheduled-${baseColor}` : "gantt-unscheduled";
      } else if (baseColor) {
        custom_class = `gantt-status-${baseColor}`;
      }

      // Fix 3: Short label inside the bar (Due date)
      let barLabel = "";
      if (p.deliveryDate) {
        const delDate = new Date(p.deliveryDate);
        const overdueText = (delDate < startOfDay(new Date())) ? " [OVERDUE]" : "";
        barLabel = `Due: ${format(delDate, "dd MMM yy")}${overdueText}`;
      } else {
        barLabel = p.projectNumber;
      }

      return {
        id: p.id.toString(),
        name: barLabel,
        start: format(start, "yyyy-MM-dd"),
        end: format(end, "yyyy-MM-dd"),
        progress: Math.min(100, Math.max(0, p.progressPercent || 0)),
        custom_class,
        dependencies: "",
      };
    });

    if (tasks.length === 0) {
      if (ganttRef.current) {
        containerRef.current.innerHTML = "";
        ganttRef.current = null;
      }
      return;
    }

    if (!ganttRef.current) {
      ganttRef.current = new Gantt(containerRef.current, tasks, {
        view_mode: "Week",
        readonly: !canDrag,
        header_height: 60,
        bar_height: 20,
        padding: 56,
        on_date_change: (task: any, start: Date) => {
          onDateChange?.(task.id, start);
        },
        on_click: (task: any) => {
          onClick?.(task);
        },
      } as any);
    } else {
      ganttRef.current.refresh(tasks);
    }
  }, [projects, onDateChange, onClick]); // only on init/data changes

  useEffect(() => {
    if (ganttRef.current && viewMode) {
      ganttRef.current.change_view_mode(viewMode);
    }
  }, [viewMode]);

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 border-dashed">
        <p className="text-sm font-medium text-slate-500">No projects to display in Gantt chart.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm p-4 min-h-[400px] max-h-[calc(100vh-250px)] flex flex-col">
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Custom Left Panel for Project Names */}
        <div 
          ref={leftPanelRef}
          className="w-64 flex-shrink-0 pt-[70px] pr-4 border-r border-slate-200 dark:border-slate-800 hidden md:block overflow-hidden"
        >
          {projects.map((p) => {
            return (
              <div 
                key={p.id} 
                className="h-[76px] flex flex-col justify-center text-xs text-slate-700 dark:text-slate-300 truncate border-b border-slate-100 dark:border-slate-800/60"
                title={`${p.projectNumber} | ${p.name}`}
              >
                <div className="flex items-center gap-3">
                  <a 
                    href={`https://app.workguru.io/App/Projects/Detail2/${p.workguruId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline hover:text-brand"
                  >
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight flex items-center gap-1.5">
                      {p.projectNumber}
                    </h3>
                    <span className="text-[10px] text-slate-500 truncate leading-tight mt-0.5 block">{p.name}</span>
                  </a>
                </div>
                <div className="mt-1 flex items-center">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${getBadgeColor(p.rawStatus)} truncate`}>
                    {formatStatusLabel(p.rawStatus)}
                  </span>
                </div>
                <span className="text-[9px] font-medium text-slate-400 mt-1 truncate">
                  {p.scheduledStart ? `Starts: ${format(new Date(p.scheduledStart), "dd MMM yy")}` : "Unscheduled"}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Gantt Chart Container */}
        <div 
          ref={ganttWrapperRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto min-w-0"
        >
          <div ref={containerRef} className="frappe-gantt-container" />
        </div>
      </div>
      
      <div className="mt-3 text-center border-t border-slate-100 dark:border-slate-800/60 pt-3">
        <p className="text-[11px] text-slate-400 font-medium">
          Drag a bar to set its start date (saved automatically). Resize to preview duration (not saved).
        </p>
      </div>
    </div>
  );
}
