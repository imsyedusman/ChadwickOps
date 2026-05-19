import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth-helpers";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { ShieldCheck, UserCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await validateSession();
  if (!session) {
    redirect("/login");
  }

  const name = session.user.name || "User";
  const email = session.user.email || "";
  const role = session.user.role || "viewer";

  const getInitials = (nameStr: string) => {
    const parts = nameStr.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return nameStr.substring(0, 2).toUpperCase();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Profile & Preferences</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Update your password and review credentials details.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* User Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 shadow-sm">
          <div className="h-20 w-20 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand text-2xl font-bold">
            {getInitials(name)}
          </div>
          <div className="space-y-1.5 text-center md:text-left flex-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{name}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{email}</p>
            <div className="pt-2 flex items-center justify-center md:justify-start gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 uppercase tracking-widest">
                Role: {role}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 inline-flex items-center gap-1 uppercase tracking-widest">
                <ShieldCheck className="h-3 w-3" />
                Active Account
              </span>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-xl text-brand">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Update Security Credentials</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Changing your password will log out all other active sessions.</p>
            </div>
          </div>
          <div className="p-6 md:p-8">
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
