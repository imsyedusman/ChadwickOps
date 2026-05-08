import type { Metadata } from "next";
import { Albert_Sans } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { UserPreferencesProvider } from "@/components/providers/user-preferences-provider";
import { Toaster } from "sonner";

const albertSans = Albert_Sans({
  variable: "--font-albert-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "WorkGuru Operations Dashboard | Chadwick Switchboards",
  description: "Real-time production planning and delivery risk management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={albertSans.variable} suppressHydrationWarning>
      <body className="antialiased font-sans flex items-stretch min-h-screen bg-background text-foreground transition-colors duration-300" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SidebarProvider>
            <UserPreferencesProvider>
              <div className="grid grid-cols-[var(--sidebar-width)_1fr] h-screen w-full overflow-hidden transition-[grid-template-columns] duration-200 ease-in-out">
                <Sidebar />
                <div className="flex flex-col h-full overflow-hidden relative border-l border-slate-200/60 dark:border-slate-800/60">
                  <Header />
                  <main className="flex-1 overflow-y-auto scroll-pt-16">
                    <div className="max-w-[1600px] mx-auto p-6 md:p-8 lg:p-10">
                      {children}
                    </div>
                  </main>
                </div>
              </div>
              <Toaster position="top-right" closeButton richColors />
            </UserPreferencesProvider>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
