import { ProcurementDashboardItem } from "@/app/actions/procurement";
import { RiskBadge } from "./RiskBadge";
import { format } from "date-fns";
import { ChevronRight, Calendar, Package2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectListProps {
  projects: ProcurementDashboardItem[];
}

export function ProcurementProjectList({ projects }: ProjectListProps) {
  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-bottom border-slate-200 dark:border-slate-800">
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Project</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Risk Level</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Lines</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Delivery Target</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status Details</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
            {projects.map((project) => (
              <tr key={project.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <a 
                      href={project.projectUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-0.5 hover:text-brand transition-colors"
                    >
                      {project.projectNumber}
                    </a>
                    <a 
                      href={project.projectUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 hover:text-brand transition-colors"
                    >
                      {project.projectName}
                    </a>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <RiskBadge level={project.risk.level} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="flex flex-col items-center">
                        <span className="text-sm font-bold tabular-nums">
                            {project.stats.totalReceived} / {project.stats.totalOrdered}
                        </span>
                        <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500 transition-all" 
                                style={{ width: `${(project.stats.totalReceived / project.stats.totalOrdered) * 100}%` }}
                            />
                        </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Calendar className="h-3.5 w-3.5 opacity-50" />
                    <span className="text-xs font-medium">
                      {project.deliveryDate ? format(new Date(project.deliveryDate), 'dd MMM yyyy') : 'No Date Set'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {project.risk.reason}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors group-hover:translate-x-1">
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {projects.length === 0 && (
        <div className="p-12 text-center">
            <Package2 className="h-12 w-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No projects found for the current filter.</p>
        </div>
      )}
    </div>
  );
}
