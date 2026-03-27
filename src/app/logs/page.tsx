import { db } from "@/db";
import { syncLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { format } from "date-fns";
import { History, CheckCircle2, XCircle } from "lucide-react";

export default async function LogsPage() {
  const logs = await db.query.syncLogs.findMany({
    orderBy: [desc(syncLogs.timestamp)],
    limit: 50,
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          Sync History
          <History className="h-6 w-6 text-slate-400" />
        </h1>
        <p className="text-sm text-slate-500 mt-1">Audit log of all data synchronization events from WorkGuru.</p>
      </div>

      <Card className="border-none shadow-sm shadow-slate-200 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">Timestamp</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center w-1/4">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">No sync events recorded yet.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium whitespace-nowrap">
                        {format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm:ss')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {log.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle2 className="h-3 w-3" /> SUCCESS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="h-3 w-3" /> FAILURE
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 leading-relaxed italic">
                        {log.details || 'No additional details provided.'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Minimal Card components
function Card({ children, className }: any) {
  return <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}
function CardContent({ children, className }: any) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}
