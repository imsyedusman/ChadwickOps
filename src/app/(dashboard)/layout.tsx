import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth-helpers";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { UserPreferencesProvider } from "@/components/providers/user-preferences-provider";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await validateSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <UserPreferencesProvider>
        <div className="grid grid-cols-[var(--sidebar-width)_1fr] h-screen w-full overflow-hidden transition-[grid-template-columns] duration-200 ease-in-out">
          <Sidebar />
          <div className="flex flex-col h-full overflow-hidden relative border-l border-slate-200/60 dark:border-slate-800/60">
            <Header user={{ name: session.user.name || "User", email: session.user.email || "" }} />
            <main className="flex-1 overflow-y-auto scroll-pt-16">
              <div className="max-w-[1900px] mx-auto p-6 md:p-8 lg:p-10">
                {children}
              </div>
            </main>
          </div>
        </div>
      </UserPreferencesProvider>
    </SidebarProvider>
  );
}
