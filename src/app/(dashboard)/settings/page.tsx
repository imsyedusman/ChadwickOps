export const dynamic = "force-dynamic";
import { WorkshopStaffSection } from "@/components/admin/WorkshopStaffSection";
import { StaffAbsencesSection } from "@/components/admin/StaffAbsencesSection";
import { SettingsLayout } from "./SettingsLayout";
import { validateSession, hasRole } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

export default async function SettingsPage() {
  const session = await validateSession();
  if (!session || !hasRole(session, "admin")) {
    redirect("/login");
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Settings className="w-8 h-8 text-slate-400" />
            Settings
          </h1>
          <p className="text-sm text-slate-500 font-bold">Manage workshop staff and system configurations.</p>
        </div>
      </div>

      <SettingsLayout 
        workshopStaff={<WorkshopStaffSection isFinance={hasRole(session, "finance")} />}
        staffAbsences={<StaffAbsencesSection />}
        capacitySettings={
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden p-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-2">Capacity Settings</h2>
            <p className="text-sm text-slate-500">
              Manage capacity settings from the Capacity and Risk page. These will be consolidated here in a future update.
            </p>
          </section>
        }
      />
    </div>
  );
}
