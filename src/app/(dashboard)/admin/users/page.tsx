export const dynamic = "force-dynamic";

import { getUsersList } from "@/app/actions/users";
import { UsersManagementClient } from "@/components/admin/UsersManagementClient";
import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";

export default async function AdminUsersPage() {
  const usersList = await getUsersList();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <Link 
          href="/admin" 
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-brand transition-colors w-fit"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to System Administration
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-xl text-brand">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">User Directory</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Create, manage, and audit user permissions.</p>
            </div>
          </div>
        </div>
      </div>

      <UsersManagementClient initialUsers={usersList} />
    </div>
  );
}
