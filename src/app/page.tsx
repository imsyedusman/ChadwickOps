import { db } from "@/db";
import { projects, clients, displayStages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { DeliveryRiskService } from "@/lib/risk";
import { StageService } from "@/lib/stages";
import { format } from "date-fns";
import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";

export default async function DashboardPage() {
  const riskService = new DeliveryRiskService();
  const allProjects = await db.query.projects.findMany({
    with: {
      client: true,
      displayStage: true,
    },
    orderBy: [desc(projects.updatedAt)],
  });

  const projectsWithRisk = await Promise.all(
    allProjects.map(async (p) => ({
      ...p,
      risk: await riskService.calculateProjectRisk(p),
    }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WIP / Operations Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time visibility into production and delivery risk.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Active Projects" 
          value={allProjects.length.toString()} 
          icon={<Clock className="h-5 w-5 text-brand" />}
        />
        <StatCard 
          title="High Risk" 
          value={projectsWithRisk.filter(p => p.risk === 'HIGH_RISK').length.toString()} 
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          trend="Needs Attention"
          trendColor="text-red-500"
        />
        <StatCard 
          title="On Track" 
          value={projectsWithRisk.filter(p => p.risk === 'ON_TRACK').length.toString()} 
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
          trend="Healthy"
          trendColor="text-green-500"
        />
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            Project List
            <Badge variant="secondary" className="font-normal">{allProjects.length} Total</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Project ID</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Project Name / Client</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Stage</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Est. Hours</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Progress</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Delivery Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectsWithRisk.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 border-none">{project.projectNumber}</td>
                    <td className="px-6 py-4 border-none">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{project.name}</span>
                        <span className="text-xs text-slate-500">{project.client.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center border-none">
                       {project.displayStage ? (
                         <div 
                           className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm transition-all border"
                           style={{ 
                             backgroundColor: project.displayStage.color + '15', 
                             color: project.displayStage.color,
                             borderColor: project.displayStage.color + '40'
                           }}
                         >
                           {project.displayStage.name}
                         </div>
                       ) : (
                         <span className="text-xs text-slate-400 italic">{project.rawStatus}</span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-slate-700 border-none">
                      {project.budgetHours}h
                    </td>
                    <td className="px-6 py-4 border-none">
                      <div className="flex flex-col gap-1.5 min-w-[120px]">
                         <div className="flex justify-between items-center text-[10px] font-medium text-slate-500">
                            <span>{project.actualHours}h used</span>
                            <span>{Math.round(project.progressPercent)}%</span>
                         </div>
                         <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                            <div 
                              className="bg-brand h-full rounded-full transition-all duration-500 ease-out" 
                              style={{ width: `${Math.min(project.progressPercent, 100)}%` }}
                            />
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600 border-none font-medium">
                      {project.deliveryDate ? format(project.deliveryDate, 'dd MMM yyyy') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-center border-none">
                      <RiskBadge risk={project.risk} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon, trend, trendColor }: any) {
  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <h3 className="text-3xl font-bold mt-1 text-slate-900 tracking-tight">{value}</h3>
            {trend && (
              <p className={`text-xs font-semibold mt-1 ${trendColor}`}>{trend}</p>
            )}
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
             {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const configs: any = {
    'HIGH_RISK': { label: 'High Risk', classes: 'bg-red-50 text-red-600 border-red-200 shadow-sm' },
    'MEDIUM_RISK': { label: 'Medium Risk', classes: 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm' },
    'ON_TRACK': { label: 'On Track', classes: 'bg-green-50 text-green-600 border-green-200 shadow-sm' },
    'DELAYED': { label: 'Delayed', classes: 'bg-slate-900 text-white border-slate-900' },
  };
  const config = configs[risk] || { label: risk, classes: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${config.classes}`}>
       {config.label}
    </span>
  );
}

// Minimal Card components if shadcn is not fully ready
function Card({ children, className }: any) {
  return <div className={`rounded-xl border border-slate-200 ${className}`}>{children}</div>;
}
function CardHeader({ children, className }: any) {
  return <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;
}
function CardTitle({ children, className }: any) {
  return <h3 className={`text-2xl font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
}
function CardContent({ children, className }: any) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}
function Badge({ children, className, variant }: any) {
  const variants: any = {
    secondary: "bg-slate-100 text-slate-900",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variants[variant] || ""} ${className}`}>{children}</span>;
}
