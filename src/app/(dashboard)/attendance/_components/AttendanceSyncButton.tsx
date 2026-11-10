"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { triggerAttendanceSync } from "@/app/actions/attendance-sync";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface AttendanceSyncButtonProps {
  canSync?: boolean;
}

export function AttendanceSyncButton({ canSync = true }: AttendanceSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    if (!canSync) {
      toast.error("Permission Denied", {
        description: "Admin or Scheduler role required to trigger timesheet sync.",
      });
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading("Syncing WorkGuru Timesheets...", {
      description: "Fetching recent timesheets and evaluating attendance exceptions.",
    });

    try {
      const res = await triggerAttendanceSync({ daysBack: 60 });

      if (res.success && res.stats) {
        toast.success("Attendance Sync Complete", {
          id: toastId,
          description: `Fetched ${res.stats.fetched} rows, upserted ${res.stats.upserted} records (${res.stats.flagged} exceptions flagged).`,
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        });
        router.refresh();
      } else {
        toast.error("Attendance Sync Failed", {
          id: toastId,
          description: res.error || "Failed to synchronize WorkGuru timesheet data.",
          icon: <AlertCircle className="h-4 w-4 text-rose-500" />,
        });
      }
    } catch (err: any) {
      toast.error("Sync Error", {
        id: toastId,
        description: err.message || "An unexpected error occurred during sync.",
        icon: <AlertCircle className="h-4 w-4 text-rose-500" />,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      title={canSync ? "Pull latest timesheets from WorkGuru" : "Admin privileges required"}
      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
      <span>{isSyncing ? "Syncing..." : "Sync Attendance"}</span>
    </button>
  );
}

