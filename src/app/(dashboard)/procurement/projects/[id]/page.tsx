import { getProjectProcurementDetail } from "@/app/actions/procurement";
import { ProjectProcurementDetail } from "@/components/procurement/ProjectProcurementDetail";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function ProjectProcurementPage({ params }: PageProps) {
    const { id } = await params;
    const projectId = parseInt(id);

    if (isNaN(projectId)) return notFound();

    const result = await getProjectProcurementDetail(projectId);

    if (!result.success || !result.project) {
        return (
            <div className="p-8">
                <Link href="/procurement" className="flex items-center gap-2 text-sm text-slate-500 hover:text-brand mb-6 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                    Back to Hub
                </Link>
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">
                    Failed to load project procurement details.
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 flex flex-col gap-6 animate-in fade-in duration-500">
            <Link href="/procurement" className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400 hover:text-brand mb-2 transition-colors">
                <ChevronLeft className="h-4 w-4" />
                Back to Procurement Hub
            </Link>

            <ProjectProcurementDetail 
                project={result.project} 
                purchaseOrders={result.purchaseOrders} 
            />
        </div>
    );
}
