import { InvoicedThisMonthSection } from "@/components/reports/InvoicedThisMonthSection";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLatestInvoiceSyncStatus } from "@/app/actions/invoice-sync";
import { SYDNEY_TZ } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function InvoicedReportPage() {
  const latestInvoiceSyncRes = await getLatestInvoiceSyncStatus();
  const latestInvoiceSync = latestInvoiceSyncRes.success ? latestInvoiceSyncRes.data : null;
  const invoiceLastUpdatedText = latestInvoiceSync 
    ? new Date(latestInvoiceSync.timestamp).toLocaleString('en-AU', {
        timeZone: SYDNEY_TZ,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : "Never";

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex-1">
        <Link 
          href="/reports"
          className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-brand transition-colors mb-4"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Reports
        </Link>
      </div>
      
      <InvoicedThisMonthSection lastSyncedText={invoiceLastUpdatedText} />
    </div>
  );
}
