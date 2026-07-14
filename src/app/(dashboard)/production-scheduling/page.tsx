import { getProductionSchedulingData } from "@/app/actions/production-scheduling";
import { ProductionSchedulingClient } from "@/components/production-scheduling/ProductionSchedulingClient";
import { validateSession, hasRole } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function ProductionSchedulingPage() {
  const result = await getProductionSchedulingData();
  const session = await validateSession();
  const hasSchedulerOrAdminRole = session ? (hasRole(session, "scheduler") || hasRole(session, "admin")) : false;
  
  if (!result.success || !result.data) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
          Failed to load production scheduling data.
        </div>
      </div>
    );
  }
  
  return <ProductionSchedulingClient initialData={result.data} canDrag={hasSchedulerOrAdminRole} />;
}
